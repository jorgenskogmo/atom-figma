function rgbToHex({ r, g, b, a }: RGBA) {
	if (a !== 1) {
		return `rgba(${[r, g, b]
			.map((n) => Math.round(n * 255))
			.join(", ")}, ${a.toFixed(4)})`;
	}
	const toHex = (value: number): string => {
		const hex = Math.round(value * 255).toString(16);
		return hex.length === 1 ? `0${hex}` : hex;
	};

	const hex = [toHex(r), toHex(g), toHex(b)].join("");
	return `#${hex}`;
}

async function test() {
	const localVariables = await figma.variables.getLocalVariablesAsync();
	// console.log("localVariables:", localVariables);

	const collections = await figma.variables.getLocalVariableCollectionsAsync();

	// Find the "theme" collection
	const themeCollection = collections.find(
		(collection) => collection.name === "theme",
	);

	if (!themeCollection) {
		console.error("Theme collection not found");
		return;
	}

	// Get all variables in the theme collection
	const themeVariables = localVariables.filter(
		(v) => v.variableCollectionId === themeCollection.id,
	);

	// console.log(
	// 	"themeVariables:",
	// 	themeVariables,
	// 	"themeCollection:",
	// 	themeCollection,
	// );

	const resolveMode = (mid: string): string => {
		const modeId = themeCollection.modes.find((mode) => mode.modeId === mid);
		if (modeId) {
			return modeId.name;
		}
		return "default";
	};

	const out: OutType[] = [];
	const tokens: string[] = [];

	for (const variable of themeVariables) {
		// console.log("theme variable:", variable.name, variable);
		const values = [];
		const keys = Object.keys(variable.valuesByMode);
		for (const key of keys) {
			const variant = variable.valuesByMode[key];
			if (typeof variant.valueOf() === "object") {
				if (Object.keys(variant).includes("id")) {
					const { id } = variant as { id: string };
					const resolved = await figma.variables.getVariableByIdAsync(id);
					if (resolved) {
						let value = Object.values(resolved.valuesByMode)[0];
						if (variable.resolvedType === "COLOR") {
							value = rgbToHex(value as RGBA);
						}
						// console.log(
						// 	"- variant",
						// 	variable.name,
						// 	"resolved to",
						// 	resolved.name,
						// 	resolved.resolvedType,
						// 	value,
						// 	"----",
						// 	key,
						// 	resolveMode(key),
						// );
						values.push(value);
						tokens.push(
							buildToken({
								name: variable.name,
								type: resolved.resolvedType,
								mode: resolveMode(key),
								value,
							}),
						);
					} else {
						console.log("- variant not resolved", id);
					}
				}
			} else {
				let value = Object.values(variable.valuesByMode)[0];
				if (variable.resolvedType === "COLOR") {
					value = rgbToHex(value as RGBA);
				}
				// console.log(
				// 	"- variable",
				// 	variable.name,
				// 	"is not aliased. Raw value:",
				// 	value,
				// 	"--HERE--",
				// 	key,
				// 	resolveMode(key),
				// );
				values.push(value);
				tokens.push(
					buildToken({
						name: variable.name,
						type: variable.resolvedType,
						mode: resolveMode(key),
						value,
					}),
				);
			}
		}

		// const obj: OutType = {
		// 	name: variable.name,
		// 	type: variable.resolvedType.toLowerCase(),
		// 	mode: "--",
		// 	values,
		// };

		// console.log("token:", variable.name, variable.resolvedType, values);

		// out.push(obj);
	}

	console.log("tokens:", tokens.sort());

	figma.showUI(__html__, { visible: false });
	figma.ui.postMessage({ type: "EXPORT_RESULT", tokens: tokens.sort() });

	setTimeout(() => figma.closePlugin(), 1000);
}

test();

type OutType = {
	name: string;
	type: string;
	mode: string;
	values: unknown;
};

type TokenType = {
	name: string;
	type: string;
	mode: string;
	value: unknown;
};

const buildToken = ({ name, type, mode, value }: TokenType): string => {
	const _mode = `${mode.replace(/ /g, "-").toLowerCase()}-`;
	let _type = `${type.toLowerCase()}-`;
	const _name = name.replace(/ /g, "-").toLowerCase();

	let unit = "";
	if (_type === "float-") {
		unit = "px";
		_type = "";
	}

	//--dark-color-fg: #f00
	return `--${_mode}${_type}${_name}: ${value}${unit};`;
};
