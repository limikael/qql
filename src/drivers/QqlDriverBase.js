import sqliteSqlstring from "sqlstring-sqlite";
import sqlstring from "sqlstring";

export default class QqlDriverBase {
	constructor({escapeFlavor}) {
		this.escapeFlavor=escapeFlavor;
	}

	quote(val, quoteChar) {
		if (val===null || val===undefined)
			return "null";

	    if (!quoteChar || quoteChar.length !== 1) {
	        throw new Error("quoteChar must be a single character: ' \" or `");
	    }

	    // Double the quote char inside the string
	    const escaped = val.replaceAll(quoteChar, quoteChar + quoteChar);
	    return `${quoteChar}${escaped}${quoteChar}`;
	}

	escapeId(id) {
		switch (this.escapeFlavor) {
			case "sqlite":
				return sqliteSqlstring.escapeId(id);
				break;

			case "mysql":
				return sqlstring.escapeId(id);
				break;

			case "postgres":
				return this.quote(id,'"');
				break;

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

			case "postgres":
				return this.quote(value,"'");
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

	makeFieldDefAutoIncrement(s) {
		return s;
	}

	hasFeature() {
		return false;
	}
}