// Example Figma file: https://www.figma.com/design/NHnYZa0JTp72aLD2qB82zC/atom-ds?node-id=0-1&t=yshzvQuDk1ZkMXxK-1

const TOKEN_PREFIX: string = "atomlib";
const NUMBER_UNIT: string = ""; //"px";

type LimitedVariableValue = boolean | string | number | RGB | RGBA;

interface TokenType {
	name: string; // the name of the variable
	mode: string; // the "column" of the variable
	type: VariableResolvedDataType;
	value: LimitedVariableValue;
}

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

const isAlias = (v: VariableValue): boolean => {
	return JSON.stringify(v).includes("VARIABLE_ALIAS");
};

const buildToken = ({ name, type, mode, value }: TokenType): string => {
	// console.log("buildToken:", name, type, mode, value);
	const _mode = `${mode.replace(/ /g, "-").toLowerCase()}`;
	const _type = `${type.toLowerCase()}`;
	const _name = name.replace(/ /g, "_").toLowerCase();
	let _value = value;

	let comment = "";
	// print Booleans as 1|0
	if (type === "BOOLEAN") {
		comment = type ? "bool:true" : "bool:false";
		_value = type ? 1 : 0;
	}

	// print Strings as comments
	if (type === "STRING") {
		return `/* ${_value} (${_name} @ ${_mode}) */`;
	}

	// append unit to numbers
	if (type === "FLOAT") {
		_value = `${_value}${NUMBER_UNIT}`;
	}

	const prefix = TOKEN_PREFIX !== "" ? `${TOKEN_PREFIX}-` : "";

	//--dark-color-fg: #f00
	return `--${prefix}${_mode}-${_type}-${_name}: ${_value}; ${comment !== "" ? `/* ${comment} */` : ""}`;
};

async function export_tokens() {
	const localVariables = await figma.variables.getLocalVariablesAsync();
	// console.log("localVariables:", localVariables);

	const collections = await figma.variables.getLocalVariableCollectionsAsync();
	// console.log("collections:", collections);

	// Find the "theme" collection
	const themeCollection = collections.find(
		(collection) => collection.name === "theme",
	);

	if (!themeCollection) {
		// todo: show ui message
		console.error("Theme collection not found");
		return;
	}

	// Get all variables in the theme collection
	const themeVariables = localVariables.filter(
		(v) => v.variableCollectionId === themeCollection.id,
	);
	// console.log("themeVariables:", themeVariables);

	const resolveVariable = (variableId: string, depth = 0): VariableValue => {
		// console.log("~ resolveVariable", variableId, depth);
		const variable = localVariables.find((v) => v.id === variableId);
		if (depth > 100) {
			console.error("Too many recursions");
			return -100;
		}
		if (!variable) {
			console.error("Variable not found");
			return -10;
		}

		// Determine if this is an alias
		const value = Object.values(variable.valuesByMode)[0]; // only the "theme" collection should have columns

		// console.log("~~ isAlias:", isAlias(value));

		if (isAlias(value)) {
			const alias = value as { type: "VARIABLE_ALIAS"; id: string };
			return resolveVariable(alias.id, depth + 1);
		}

		return value;
	};

	const tokens: string[] = [];

	// loop through all themeVariables
	for (const variable of themeVariables) {
		// console.log("theme variable:", variable.name, variable);

		const name = variable.name;
		const type = variable.resolvedType;

		/// ...and their valuesByModes (Figma: "variable mode" (e.g. columns in the variable editor)
		const valuesByModeKeys = Object.keys(variable.valuesByMode);
		for (const vmk of valuesByModeKeys) {
			const variant = variable.valuesByMode[vmk];

			/// find their raw value (recursively traverse the alias-chain)
			let rawValue = variant;
			if (isAlias(variant)) {
				const alias = variant as { type: "VARIABLE_ALIAS"; id: string };
				rawValue = resolveVariable(alias.id);
			}

			/// no aliases from here on
			let value = <LimitedVariableValue>rawValue;

			if (variable.resolvedType === "COLOR") {
				value = rgbToHex(value as RGBA);
			}

			const _modeName = themeCollection.modes.find(
				(mode) => mode.modeId === vmk,
			);
			const mode = _modeName ? _modeName.name : "default";

			// console.log(
			// 	"T",
			// 	name,
			// 	mode,
			// 	type,
			// 	value,
			// );

			tokens.push(
				buildToken({
					name,
					type,
					mode,
					value,
				}),
			);
		}
	}

	const sorted_tokens = tokens.sort();
	// console.log("tokens:", sorted_tokens);

	figma.showUI(__html__, { visible: false });
	figma.ui.postMessage({ type: "EXPORT_RESULT", tokens: sorted_tokens });

	setTimeout(() => figma.closePlugin(), 1000);
}

export_tokens();
