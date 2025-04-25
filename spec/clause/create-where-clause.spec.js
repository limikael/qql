import {createWhereClause, canonicalizeCondition} from "../../src/clause/create-where-clause.js";

describe('createWhereClause', () => {
    const schema = {
        tables: {
            tasks: {
                fields: {
                    id: { filter: true },
                    title: { filter: true },
                    agent_code: { filter: true, ref: 'agents' }
                },
                getPrimaryKeyFieldName() {
                    return 'id';
                }
            },
            agents: {
                fields: {
                    code: { filter: true },
                    name: { filter: true }
                },
                getPrimaryKeyFieldName() {
                    return 'code';
                }
            }
        }
    };

    it('should generate SQL for simple equality condition', () => {
        const query = { title: 'Task A' };
        const { clause, values, joins } = createWhereClause(query, 'tasks', schema);

        expect(clause).toBe('WHERE tasks.title = ?');
        expect(values).toEqual(['Task A']);
        expect(joins).toEqual([]);
    });

    it('should handle $in operator', () => {
        const query = { id: { $in: [1, 2, 3] } };
        const { clause, values, joins } = createWhereClause(query, 'tasks', schema);

        expect(clause).toBe('WHERE tasks.id IN (?, ?, ?)');
        expect(values).toEqual([1, 2, 3]);
        expect(joins).toEqual([]);
    });

    it('should handle $ref operator with a join', () => {
        const query = { agent_code: { $ref: { name: 'Alice' } } };
        const { clause, values, joins } = createWhereClause(query, 'tasks', schema);

        //console.log({clause,values,joins});

        //expect(clause).toBe('WHERE tasks.agent_code = ?');
        expect(clause).toBe('WHERE (agents_0.name = ?)');
        expect(values).toEqual(['Alice']);
        expect(joins).toEqual([
            'LEFT JOIN agents AS agents_0 ON agents_0.code = tasks.agent_code'
        ]);
    });

    it('should handle $and logical operator', () => {
        const query = {
            $and: [
                { title: 'Task A' },
                { agent_code: { $ref: { name: 'Alice' } } }
            ]
        };
        const { clause, values, joins } = createWhereClause(query, 'tasks', schema);

        expect(clause).toBe('WHERE (tasks.title = ?) AND ((agents_0.name = ?))');
        expect(values).toEqual(['Task A', 'Alice']);
        expect(joins).toEqual([
            'LEFT JOIN agents AS agents_0 ON agents_0.code = tasks.agent_code'
        ]);
    });

    it('should handle $or logical operator', () => {
        const query = {
            $or: [
                { title: 'Task A' },
                { agent_code: { $ref: { name: 'Alice' } } }
            ]
        };
        const { clause, values, joins } = createWhereClause(query, 'tasks', schema);

        //expect(clause).toBe('WHERE tasks.title = ? OR tasks.agent_code = ?');
        expect(clause).toBe('WHERE (tasks.title = ?) OR ((agents_0.name = ?))');
        expect(values).toEqual(['Task A', 'Alice']);
        expect(joins).toEqual([
            'LEFT JOIN agents AS agents_0 ON agents_0.code = tasks.agent_code'
        ]);
    });

    it('should handle mixed logical operators', () => {
        const query = {
            $and: [
                { title: 'Task A' },
                { $or: [{ agent_code: { $ref: { name: 'Alice' } } }, { agent_code: 'Bob' }] }
            ]
        };
        const { clause, values, joins } = createWhereClause(query, 'tasks', schema);

        expect(clause).toBe('WHERE (tasks.title = ?) AND (((agents_0.name = ?)) OR (tasks.agent_code = ?))');
        expect(values).toEqual(['Task A', 'Alice', 'Bob']);
        expect(joins).toEqual([
            'LEFT JOIN agents AS agents_0 ON agents_0.code = tasks.agent_code'
        ]);
    });

    it('should throw an error if referenced table schema is missing', () => {
        const query = { agent_code: { $ref: { name: 'Alice' } } };
        const brokenSchema = {
            tables: {
                tasks: {
                    fields: {
                        agent_code: { filter: true, ref: 'agents' }
                    },
                    getPrimaryKeyFieldName() {
                        return 'id';
                    }
                }
            }
        };

        expect(() => createWhereClause(query, 'tasks', brokenSchema)).toThrowError('Missing schema for referenced table: agents');
    });

    it("can do simple stuff",()=>{
        //console.log(createWhereClause({title: {$gt: 1, $lt: 5}},"tasks",schema));
        //console.log(createWhereClause({"title>": 5},"tasks",schema));

        //console.log(canonicalizeCondition({"title>":5, "title<":10, "title":{$eq: 7}}));
        //console.log(canonicalizeCondition({"title":5}));
        //console.log(canonicalizeCondition({title: {$gt: 1, $lt: 5}}));

        //console.log(canonicalizeCondition({"$and":[{"title":"Task A"},{"agent_code":{"$ref":{"name":"Alice"}}}]}));
    });

    it("handles null correctly",()=>{
        //console.log(createWhereClause({title: null},"tasks",schema));
        expect(createWhereClause({title: null},"tasks",schema)).toEqual({ clause: 'WHERE tasks.title IS NULL', values: [], joins: [] });
        //console.log(createWhereClause({title: {$ne: null}},"tasks",schema));
    });
});
