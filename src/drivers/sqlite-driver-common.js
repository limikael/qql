function sqliteParseDescribeRows(rows) {
	return rows.map(row=>({
		name: row.name,
		notnull: !!row.notnull,
		type: row.type.toLowerCase(),
		pk: !!row.pk,
		defaultSql: row.dflt_value
	}));
}

async function sqliteGetTableNames(sqliteDriver) {
	let nameRows=await sqliteDriver.query("SELECT name FROM sqlite_schema",[],"rows");
	nameRows=nameRows.filter(row=>!row.name.startsWith("_cf"));

	return nameRows.map(row=>row.name);
}

export async function sqliteDescribe(sqliteDriver) {
	let tableNames=await sqliteGetTableNames(sqliteDriver);
	let queries=[];
	for (let tableName of tableNames)
		queries.push(`PRAGMA table_info (${sqliteDriver.escapeId(tableName)})`);

	let queryResults=await sqliteDriver.queries(queries,"rows");
	if (queryResults.length!=tableNames.length)
		throw new Error("Didn't get the same amount of tables!");

	let res=[];
	for (let i=0; i<tableNames.length; i++) {
		res.push({
			name: tableNames[i], 
			fields: sqliteParseDescribeRows(queryResults[i])
		});
	}

	return res;
}
