import QqlDriverBase from "./QqlDriverBase.js";
import {sqliteDescribe} from "./sqlite-driver-common.js";

export default class QqlDriverBetterSqlite3 extends QqlDriverBase {
	constructor(db) {
		super({escapeFlavor: "sqlite"});
		this.db=db;
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

		let statement=this.db.prepare(query).bind(...params);
		let info;

		switch (returnType) {
			case "rows":
				if (!statement.reader) {
					statement.run();
					return [];
				}

				return statement.all();
				break;

			case "id": {
				let info=statement.run();
				return info.lastInsertRowid;
				break;
			}

			case "changes": {
				let info=statement.run();
				return info.changes;
				break;
			}

			case undefined:
			case "none":
				statement.run();
				break;

			default:
				reject(new Error("Unknown return type: "+returnType));
				break;
		}
	}
}
