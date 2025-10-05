# QQL Query Language

## Queries and clauses
- [`manyFrom`](#manyfrom) - Fetch multiple rows from a table.
- [`oneFrom`](#onefrom) - Fetch a single row from a table.
- [`insertInto`](#insertinto) - Insert new rows into a table.
- [`update`](#update) - Update existing rows in a table.
- [`deleteFrom`](#deletefrom) - Delete rows from a table.
- [`where`](#where) - Filter which rows are selected, updated, or deleted.
- [`select`](#select) - Choose which columns to return.
- [`include`](#include) - Include related data.
- [`sort`](#orderby) - Sort data.
- [`limit`](#limit) - Limit number of returned rows.
- [`offset`](#offset) - Skip a number of rows before returning results.

### `manyFrom`
Fetch multiple rows from a table.

```js
await qql({ manyFrom: "users" });
```

**Description**  
Selects all rows from the specified table. You can combine it with other clauses like `where`, `select`, `orderBy`, and `limit`.

**Example**
```js
await qql({
  manyFrom: "users",
  where: { active: true },
  orderBy: { name: "asc" },
  limit: 20
});
```

### `oneFrom`
Fetch a single row from a table.

```js
await qql({ oneFrom: "users", where: { id: 1 } });
```

**Description**  
Like `manyFrom`, but returns only a single result (or `null` if none matches).  
Internally, it’s equivalent to `limit: 1` but with a simplified API.

### `insertInto`
Insert new rows into a table.

```js
await qql({
  insertInto: "users",
  values: { name: "Mikael", email: "mikael@example.com" }
});
```

**Description**  
Inserts a new row.  
You can also pass an array of objects to insert multiple rows at once.

```js
await qql({
  insertInto: "users",
  values: [
    { name: "Anna" },
    { name: "Jonas" }
  ]
});
```

### `update`
Update existing rows in a table.

```js
await qql({
  update: "users",
  set: { active: false },
  where: { id: 5 }
});
```

**Description**  
Updates rows that match the `where` condition.  
Without a `where` clause, *all rows* will be updated.

### `deleteFrom`
Delete rows from a table.

```js
await qql({
  deleteFrom: "users",
  where: { id: 5 }
});
```

**Description**  
Deletes rows matching the `where` condition.  
Be careful — omitting `where` will delete *all* rows.

## Clauses

### `where`
Filter which rows are selected, updated, or deleted.

```js
await qql({
  manyFrom: "users",
  where: { active: true, country: "SE" }
});
```

**Description**  
The `where` clause uses a simple object syntax.  
Each key corresponds to a column name, and values are matched using `=` by default.

**Operators**

| Operator | Example | SQL Equivalent |
|-----------|----------|----------------|
| `$gt` | `{ age: { $gt: 18 } }` | `age > 18` |
| `$lt` | `{ age: { $lt: 65 } }` | `age < 65` |
| `$in` | `{ country: { $in: ["SE", "NO"] } }` | `country IN ('SE','NO')` |
| `$like` | `{ name: { $like: "%Mik%" } }` | `name LIKE '%Mik%'` |
| `$not` | `{ active: { $not: true } }` | `active != true` |

You can also nest `and` / `or` expressions:
```js
where: {
  $or: [
    { country: "SE" },
    { country: "NO" }
  ]
}
```

### `select`
Choose which columns to return.

```js
await qql({
  manyFrom: "users",
  select: ["id", "name"]
});
```

**Description**  
If omitted, all columns are returned (`SELECT *`).  
Can include joined columns using `table.column` syntax.

### `join`
Join other tables into the query.

```js
await qql({
  manyFrom: "posts",
  join: {
    users: { on: { "posts.userId": "users.id" } }
  },
  select: ["posts.id", "posts.title", "users.name"]
});
```

**Description**  
Supports inner joins by default.  
`join` is an object mapping table names to join definitions.

**Example with multiple joins**
```js
join: {
  users: { on: { "posts.userId": "users.id" } },
  comments: { on: { "posts.id": "comments.postId" } }
}
```

### `inlude`
The `include` clause in QQL allows you to fetch related or nested data along with your main query. Instead of flattening data like a SQL `JOIN`, `include` performs nested subqueries, returning structured objects with embedded data.

This makes it ideal for fetching hierarchical data such as users and their related articles, comments, or profiles.

For example:

```js
await qql({
  manyFrom: "users",
  include: {
    articles: { manyFrom: "articles" }
  }
});
```

`include` supports all regular query clauses inside (like `where`, `sort`, `limit`, etc.), so you can control what gets fetched at each level.


**Example - Basic Include**

Fetch users along with all their articles.

```js
await qql({
  manyFrom: "users",
  include: {
    articles: { manyFrom: "articles" }
  }
});
```

**Result:**
```js
[
  {
    id: 1,
    name: "Mikael",
    articles: [
      { id: 10, title: "Intro to QQL" },
      { id: 11, title: "Advanced Isomorphism" }
    ]
  }
]
```

**Example - Custom property names**

The property name under `include` defines the key in the returned object - it doesn’t have to match the table name.

```js
await qql({
  manyFrom: "users",
  include: {
    published_articles: {
      manyFrom: "articles",
      where: { published: true }
    }
  }
});
```

**Result:**
```js
[
  {
    id: 1,
    name: "Mikael",
    published_articles: [
      { id: 10, title: "Intro to QQL", published: true }
    ]
  }
]
```

**Example - Nested Includes**

```js
await qql({
  manyFrom: "users",
  include: {
    published_articles: {
      manyFrom: "articles",
      where: { published: true },
      include: {
        comments: { manyFrom: "comments" }
      }
    }
  }
});
```

**Result:**
```js
[
  {
    id: 1,
    name: "Mikael",
    published_articles: [
      {
        id: 10,
        title: "Intro to QQL",
        comments: [
          { id: 100, text: "Great read!" }
        ]
      }
    ]
  }
]
```

**Notes**  
- `include` is evaluated **per parent record**, not as a single join.
- Each nested query can use `where`, `orderBy`, `limit`, `offset`, and other QQL clauses.
- Multiple includes can be used in the same query.
- Deep nesting is supported — each level behaves just like a normal QQL query.


### `sort`
Sort the results.

```js
await qql({
  manyFrom: "users",
  orderBy: { createdAt: "desc" }
});
```

**Description**  
Takes an object mapping column names to `"asc"` or `"desc"`.  
Multiple sort columns can be specified:

```js
orderBy: { country: "asc", name: "asc" }
```

### `limit`
Limit the number of rows returned.

```js
await qql({
  manyFrom: "users",
  limit: 10
});
```

**Description**  
Restricts how many rows are returned.

### `offset`
Skip a number of rows before returning results.

```js
await qql({
  manyFrom: "users",
  limit: 10,
  offset: 20
});
```

**Description**  
Useful for pagination in combination with `limit`.
