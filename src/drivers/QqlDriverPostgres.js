import QqlDriverBase from "./QqlDriverBase.js";

function convertQuestionMarksToDollar(sql) {
	let paramIndex = 0
	return sql.replace(/\?/g, () => {
		paramIndex += 1
		return `$${paramIndex}`
	});
}

export default class QqlDriverPostgres extends QqlDriverBase {
	constructor({pool}) {
		super({escapeFlavor: "postgres"});

		if (!pool)
			throw new Error("Need pool for postgres driver");

		this.pool=pool;
	}

	/*async obtainConnection() {
		if (!this.connection)
			this.connection=await this.pool.connect();

		return this.connection;
	}*/

	async describe() {
		let tableNames=await this.getTableNames();
		let res=[];

		for (let tableName of tableNames)
			res.push({name: tableName, fields: await this.getDescribeRows(tableName)});

		return res;
	}

	async getTableNames() {
		let nameRows=await this.query(
			"SELECT table_schema, table_name "+
			"FROM information_schema.tables "+
			"WHERE table_type = 'BASE TABLE' "+
			"AND table_schema NOT IN ('pg_catalog', 'information_schema')",[],"rows");

		return nameRows.map(row=>row.table_name);
	}

	async getDescribeRows(tableName) {
    	//table_schema = 'public' ???

		let rows=await this.query(
			"SELECT column_name, data_type, is_nullable, column_default "+
			"FROM information_schema.columns "+
			"WHERE table_name=?",
			[tableName],"rows");

		let pkRows=await this.query(
			"SELECT column_name "+
			"FROM information_schema.table_constraints tc "+
			"JOIN information_schema.key_column_usage kcu "+
			"  ON tc.constraint_name = kcu.constraint_name "+
			"  AND tc.table_schema = kcu.table_schema "+
			"WHERE tc.constraint_type = 'PRIMARY KEY' "+
			"  AND tc.table_name=?",
			[tableName],"rows");

		let pkCols=pkRows.map(r=>r.column_name);

		return rows.map(row=>{
			let describeRow={
				name: row.column_name,
				notnull: row.is_nullable=="NO",
				type: row.data_type,
				pk: pkCols.includes(row.column_name),
			}

			if (describeRow.pk)
				describeRow.defaultSql=null;

			else
				describeRow.defaultSql=row.column_default;

			return describeRow;
		});
	}

	query=async (query, params=[], returnType)=>{
		/*let connection=await this.obtainConnection();
		let res=await connection.query(convertQuestionMarksToDollar(query),params);*/

		let res=await this.pool.query(convertQuestionMarksToDollar(query),params);

		switch (returnType) {
			case "rows":
				return res.rows;
				break;

			case "id":
				throw new Error("id not supported for postgres");
				break;

			case "changes":
				return res.rowCount;
				break;

			case undefined:
			case "none":
				break;

			default:
				throw new Error("Unknown return type: "+returnType);
				break;
		}
	}

	makeFieldDefAutoIncrement(s) {
		return s.replace("integer","serial");
	}

	hasFeature(feature) {
		switch (feature) {
			case "returning":
				return true;
		}

		return false;
	}
}
