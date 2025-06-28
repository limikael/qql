import QqlDriverBase from "./QqlDriverBase.js";

export default class QqlDriverBetterSqlite3 extends QqlDriverBase {
	constructor(db) {
		super({escapeFlavor: "sqlite"});
		this.db=db;
	}

	async query(query, params, returnType) {
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
