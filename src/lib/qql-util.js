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

export function canonicalizeSort(sort) {
	function sortDirection(cand) {
		if (!cand)
			return "asc";

		cand=cand.toLowerCase();
		if (!["asc","desc"].includes(cand))
			throw new Error("Unknown sort direction: "+cand);

		return cand;
	}

	if (!sort)
		return {};

	if (typeof sort=="string")
		return {[sort]: sortDirection()}

	if (Array.isArray(sort) &&
			Array.isArray(sort[0])) {
		let res={};
		for (let item of sort)
			res[item[0]]=sortDirection(item[1]);

		return res;
	}

	if (Array.isArray(sort)) {
		return {[sort[0]]: sortDirection(sort[1])}
	}

	sort={...sort};
	for (let k in sort)
		sort[k]=sortDirection(sort[k]);

	return sort;
}

export function objectifyRows({columns, values}) {
	let rows=[];

	for (let valueRow of values) {
		let o={};
		for (let i=0; i<columns.length; i++)
			o[columns[i]]=valueRow[i];

		rows.push(o);
	}

	return rows;
}