# QQL

QQL is a query builder.

All queries are plain javascript object. One of the benefits of this is that they can easily be
serialized and sent in a call to a server. The goal is that it should be possible, in the context
of a web app, to access the database directly from the client as well as from the server, 
with the same API. There is also a permission based view system, to allow the correct access
depending on the context, even if the API is the same.

## Example

```js

let qql=createQql({
	sqlite: new sqlite3.Database(':memory:'),
	tables: {
		// ... schema def here ...
	}
});
await qql({insertInto: "users", set: {name: "alice"}});
let result=await qql({manyFrom: "users", where: {name: "alice"}});
await qql({update: "users", set: {name: "bob"}, where: {name: "alice"}});
await qql({deleteFrom: "users", where: {name: "bob"}});
```

## Schema and migration
