//import sqlstring from "sqlstring-sqlite";

export default class Field {
	constructor(spec) {
		Object.assign(this,{
			qql: spec.qql,
			name: spec.name,
			type: spec.type,
			pk: !!spec.pk,
			notnull: !!spec.notnull,
			/*reference_table: spec.reference_table,
			reference_field: spec.reference_field*/
		});

		if (spec.defaultSql)
			this.defaultSql=spec.defaultSql;

		else
			this.defaultSql=this.qql.escapeValue(spec.default);

		this.sqlType();
	}

	sqlType() {
		let typeMap={
		    "text": "text",
		    "date": "date",
		    "datetime": "datetime",
		    "integer": "integer",
		    "boolean": "boolean",
		    "real": "real",
		    "json": "text",
		}

		let mappedType=typeMap[this.type.toLowerCase()];
		if (!mappedType)
			throw new Error("unknown type: "+this.type);

		return mappedType;
	}

	defEquals(that) {
		if (!that)
			return false;

		let eq=(
			this.name==that.name
			&& this.sqlType()==that.sqlType()
			&& this.pk==that.pk
			&& this.notnull==that.notnull
			&& this.defaultSql==that.defaultSql
		);

		if (!eq) {
			console.log("diff: ",this,that);
		}

		return eq;
	}

	createWhereExpression(value, op) {
		if (!op)
			op="=";

		if (op=="=" && Array.isArray(value))
			return (
				this.qql.escapeId(this.name)+" IN ("+
				value.map(v=>this.qql.escapeValue(v)).join(",")+")"
			);

		else
			return (
				this.qql.escapeId(this.name)+op+this.qql.escapeValue(value)
			);
	}

	represent(data) {
		switch (this.type) {
			case "json":
				return JSON.stringify(data);
				break;

			default:
				return data;
		}
	}

	present(data) {
		switch (this.type) {
			case "json":
				return JSON.parse(data);
				break;

			case "boolean":
				return Boolean(data);
				break;

			default:
				return data;
		}
	}

	static fromDescribeRow(row) {
		let t=row.type.split("(")[0].toLowerCase();
		if (t=="varchar")
			t="text";

		//console.log(row);

		return new Field({
			notnull: !!row.notnull,
			name: row.name,
			type: t,
			pk: !!row.pk,
			defaultSql: row.dflt_value
		});
	}

	getCreateSql() {
		let s=this.qql.escapeId(this.name)+" ";
		s+=this.sqlType();
		s+=(this.notnull?" not null":" null");
		if (this.defaultSql!=="null")
			s+=" default "+this.defaultSql;

		if (this.pk)
			s+=" primary key";

		return s;
	}
}