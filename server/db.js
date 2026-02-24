const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const convertSql = (sql) => {
    let paramCount = 1;
    // Basic replacement for ? to $1, $2 etc.
    // Handles most cases unless ? is inside a string literal, which sqlite queries mostly avoid when parameterized
    while (sql.includes('?')) {
        sql = sql.replace('?', `$${paramCount++}`);
    }
    return sql;
};

const db = {
    prepare: (sqliteSql) => {
        const pgSql = convertSql(sqliteSql);

        const convertBigInt = (obj) => {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj === 'bigint') return Number(obj);
            if (Array.isArray(obj)) return obj.map(convertBigInt);
            if (typeof obj === 'object' && !(obj instanceof Date)) {
                const newObj = {};
                for (const [key, value] of Object.entries(obj)) {
                    newObj[key] = convertBigInt(value);
                }
                return newObj;
            }
            return obj;
        };

        const toDateParams = (params) => {
            return params.map(p => {
                if (typeof p === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(p)) {
                    const d = new Date(p);
                    return isNaN(d.getTime()) ? p : d;
                }
                return p;
            });
        };

        return {
            get: async (...params) => {
                try {
                    const parsedParams = toDateParams(params);
                    const res = await prisma.$queryRawUnsafe(pgSql, ...parsedParams);
                    return convertBigInt(res[0] || undefined);
                } catch (err) {
                    console.error('DB GET Error:', pgSql, params, err.message);
                    throw err;
                }
            },
            all: async (...params) => {
                try {
                    const parsedParams = toDateParams(params);
                    const res = await prisma.$queryRawUnsafe(pgSql, ...parsedParams);
                    return convertBigInt(res);
                } catch (err) {
                    console.error('DB ALL Error:', pgSql, params, err.message);
                    throw err;
                }
            },
            run: async (...params) => {
                try {
                    const parsedParams = toDateParams(params);
                    let currentSql = pgSql;
                    const isInsert = /^\s*INSERT\s+INTO/i.test(currentSql);
                    if (isInsert && !/RETURNING\s+id/i.test(currentSql)) {
                        currentSql += ' RETURNING id';
                    }
                    if (isInsert) {
                        const res = await prisma.$queryRawUnsafe(currentSql, ...parsedParams);
                        return { lastInsertRowid: convertBigInt(res[0]?.id) };
                    } else {
                        const res = await prisma.$executeRawUnsafe(currentSql, ...parsedParams);
                        return { changes: res };
                    }
                } catch (err) {
                    console.error('DB RUN Error:', pgSql, params, err.message);
                    throw err;
                }
            }
        };
    },
    transaction: (fn) => {
        return async (...args) => {
            return await fn(...args);
        };
    }
};

module.exports = db;
