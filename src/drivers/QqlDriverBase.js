import sqliteSqlstring from "sqlstring-sqlite";
import sqlstring from "sqlstring";

export default class QqlDriverBase {
	constructor({escapeFlavor}) {
		this.escapeFlavor=escapeFlavor;
	}

	escapeId(id) {
		switch (this.escapeFlavor) {
			case "sqlite":
				return sqliteSqlstring.escapeId(id);
				break;

			case "mysql":
				return sqlstring.escapeId(id);

			default:
				throw new Error("unknown escape flavor: "+this.escapeFlavor);
		}
	}

	escapeValue(value) {
		switch (this.escapeFlavor) {
			case "sqlite":
				return sqliteSqlstring.escape(value);
				break;

			case "mysql":
				return sqlstring.escape(value);
				break;

			default:
				throw new Error("unknown escape flavor: "+this.escapeFlavor);
		}
	}

	async queries(queries, returnType) {
		//console.log("qs: ",queries);

		let res=[];

		for (let query of queries)
			res.push(await this.query(query,[],returnType));

		return res;
	}
}