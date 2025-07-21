import QqlDriverBase from "./QqlDriverBase.js";
import {sqliteDescribe} from "./sqlite-driver-common.js";

export default class QqlDriverLibSql extends QqlDriverBase {
	constructor({client}) {
		super({escapeFlavor: "sqlite"});
		this.client=client;
	}

	async describe() {
		return await sqliteDescribe(this);
	}

	async query(query, params, returnType) {
		params=params.map(p=>{
			if (p===true)
				p=1;

			if (p===false)
				p=0;

			return p;
		});

		let res=await this.client.execute(query,params);
		switch (returnType) {
			case "rows":
				return res.rows;
				break;

			case "id":
				return Number(res.lastInsertRowid);
				break;

			case "changes":
				return res.rowsAffected;
				break;

			case undefined:
			case "none":
				return;
				break;

			default:
				reject(new Error("Unknown return type: "+returnType));
				break;
		}
	}
}
