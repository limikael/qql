export async function sqliteGetDescribeRows(sqliteDriver, tableName) {
	let rows=await sqliteDriver.query(`PRAGMA table_info (${sqliteDriver.escapeId(tableName)})`,[],"rows");
	//console.log(rows);

	return rows.map(row=>({
		name: row.name,
		notnull: !!row.notnull,
		type: row.type.toLowerCase(),
		pk: !!row.pk,
		defaultSql: row.dflt_value
	}));
}