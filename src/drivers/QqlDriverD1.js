import QqlDriverBase from "./QqlDriverBase.js";
import {sqliteDescribe} from "./sqlite-driver-common.js";

export default class QqlDriverD1 extends QqlDriverBase {
	constructor(d1) {
		super({escapeFlavor: "sqlite"});

		this.d1=d1;
	}

	async describe() {
		return await sqliteDescribe(this);
	}

	async query(query, params, returnType) {
		//console.log("d1 query",query,params);

		let qr;
		switch (returnType) {
			case "rows":
				qr=await this.d1.prepare(query).bind(...params).all();
				if (!qr.success)
					throw new Error("Query failed");
				return qr.results;
				break;

			case "id":
				qr=await this.d1.prepare(query).bind(...params).run();
				if (!qr.success)
					throw new Error("Query failed");
				return qr.meta.last_row_id;
				break;

			case "changes":
				qr=await this.d1.prepare(query).bind(...params).run();
				if (!qr.success)
					throw new Error("Query failed");
				return qr.meta.changes;
				break;

			case "none":
				qr=await this.d1.prepare(query).bind(...params).run();
				if (!qr.success)
					throw new Error("Query failed");
				return;
				break;

			default:
				throw new Error("Unknown query return type: "+returnType);
		}
	}

	queries=async(queries, returnType)=>{
		let res=[];

		for (let query of queries)
			res.push(await this.query(query, [], returnType))

		return res;
	}
}
