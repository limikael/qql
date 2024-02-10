export function canonicalizeJoins(joins) {
	if (typeof joins=="string")
		joins=[joins];

	if (Array.isArray(joins)) {
		return joins.map(join=>{
			if (typeof join=="string")
				join={join};

			return join;
		});
	}

	else if (joins) {
		return Object.keys(joins).map(join=>{
			return {join: join, ...joins[join]};
		});
	}

	return [];
}