import {jsonClone} from "../utils/js-util.js";
import {qfill} from "../lib/qql-util.js";

export default class Field {
	constructor(spec) {
		Object.assign(this,{
			qql: spec.qql,
			name: spec.name,
			type: spec.type,
			pk: !!spec.pk,
			notnull: !!spec.notnull,
		});

		if (spec.defaultSql) {
			this.defaultSql=spec.defaultSql;
		}

		else {
			let def=spec.default;
			if (!def)
				def=null;
			this.default=jsonClone(def);
			this.haveDefault=true;
			this.defaultSql=this.qql.escapeValue(spec.default);
		}

		this.sqlType();
	}

	getDefault() {
		if (!this.haveDefault)
			throw new Error();

		return this.default;
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
			//console.log("diff: ",this,that);
		}

		return eq;
	}

	/*createWhereExpression(value, op) {
		if (!op)
			op="=";

		if (value===undefined)
			throw new Error("Undefined in where expression");

		if (op=="=" && Array.isArray(value)) {
			return {
				sql: this.qql.escapeId(this.name)+" IN ("+qfill(value.length)+")",
				params: value
			};
		}

		else {
			switch (op) {
				case "~":
					if (value===null)
						throw new Error("Illegal comparision with null value");

					return {
						sql: "UPPER("+this.qql.escapeId(this.name)+") LIKE ?",
						params: ["%"+String(value).toUpperCase()+"%"]
					}
					break;

				case "=":
					if (value===null) {
						return {
							sql: this.qql.escapeId(this.name)+"is null",
							params: []
						}
					}

					return {
						sql: this.qql.escapeId(this.name)+op+"?",
						params: [value]
					}
					break;

				case ">":
				case "<":
				case ">=":
				case "<=":
					if (value===null)
						throw new Error("Illegal comparision with null value");

					return {
						sql: this.qql.escapeId(this.name)+op+"?",
						params: [value]
					}
					break;

				default:
					throw new Error("Unknown op: "+op);
			}
		}
	}*/

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

	static fromDescribeRow(row, qql) {
		let t=row.type.split("(")[0].toLowerCase();
		if (t=="varchar")
			t="text";

		//console.log(row);

		return new Field({
			qql: qql,
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