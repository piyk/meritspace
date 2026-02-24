const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL
});
const sqlite = new Database('exam_system.db');

sqlite.pragma('journal_mode = WAL');

const toDate = (str) => {
    if (!str) return null;
    if (str.includes('Z') || str.includes('T')) return new Date(str);
    return new Date(str + 'Z');
};

async function migrate() {
    console.log('Connecting to PostgreSQL...');
    await prisma.$connect();

    // 1. users
    const users = sqlite.prepare('SELECT * FROM users').all();
    console.log(`Migrating ${users.length} users...`);
    for (const u of users) {
        await prisma.$executeRawUnsafe(`
            INSERT INTO users (id, email, name, role, picture, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
        `, u.id, u.email, u.name, u.role, u.picture, toDate(u.registered_at));
    }

    // 2. exam_groups
    try {
        const groups = sqlite.prepare('SELECT * FROM exam_groups').all();
        console.log(`Migrating ${groups.length} exam_groups...`);
        for (const g of groups) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO exam_groups (id, name, created_by, created_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO NOTHING
            `, g.id, g.name, g.created_by, toDate(g.created_at));
        }
    } catch (e) { }

    // 3. exams
    const exams = sqlite.prepare('SELECT * FROM exams').all();
    console.log(`Migrating ${exams.length} exams...`);
    for (const e of exams) {
        await prisma.$executeRawUnsafe(`
            INSERT INTO exams (id, title, course, term, duration_minutes, start_time, created_by, is_public, permitted_emails, status, shuffle_questions, shuffle_options, show_score, created_at, group_id, allow_late_submission, start_method, theme_config, show_in_dashboard)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT (id) DO NOTHING
        `, e.id.toString(), e.title, e.course, e.term, e.duration_minutes, toDate(e.start_time), e.created_by, e.is_public, e.permitted_emails, e.status, e.shuffle_questions, e.shuffle_options, e.show_score, toDate(e.created_at), e.group_id, e.allow_late_submission, e.start_method, e.theme_config, e.show_in_dashboard);
    }

    // 4. exam_sections
    try {
        const sections = sqlite.prepare('SELECT * FROM exam_sections').all();
        console.log(`Migrating ${sections.length} exam_sections...`);
        for (const s of sections) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO exam_sections (id, exam_id, title, description, order_index)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO NOTHING
            `, s.id, s.exam_id ? s.exam_id.toString() : null, s.title, s.description, s.order_index);
        }
    } catch (e) { }

    // 5. questions
    try {
        const questions = sqlite.prepare('SELECT * FROM questions').all();
        console.log(`Migrating ${questions.length} questions...`);
        for (const q of questions) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO questions (id, exam_id, type, question_text, options, correct_answers, image_url, is_required, section_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO NOTHING
            `, q.id, q.exam_id ? q.exam_id.toString() : null, q.type, q.question_text, q.options, q.correct_answers, q.image_url, q.is_required, q.section_id);
        }
    } catch (e) { }

    // 6. submissions
    try {
        const submissions = sqlite.prepare('SELECT * FROM submissions').all();
        console.log(`Migrating ${submissions.length} submissions...`);
        for (const sub of submissions) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO submissions (id, exam_id, student_id, std_id, answers, status, score, raw_score, total_questions, submitted_questions, started_at, submitted_at, is_late)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id) DO NOTHING
            `, sub.id, sub.exam_id ? sub.exam_id.toString() : null, sub.student_id, sub.std_id, sub.answers, sub.status, sub.score, sub.raw_score, sub.total_questions, sub.submitted_questions, toDate(sub.started_at), toDate(sub.submitted_at), sub.is_late);
        }
    } catch (e) { }

    // 7. activity_logs
    try {
        const logs = sqlite.prepare('SELECT * FROM activity_logs').all();
        console.log(`Migrating ${logs.length} activity_logs...`);
        let logCount = 0;
        for (const l of logs) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO activity_logs (id, submission_id, event_type, timestamp)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO NOTHING
            `, l.id, l.submission_id, l.event_type, toDate(l.timestamp));
            logCount++;
            if (logCount % 1000 === 0) console.log(`${logCount} logs migrated...`);
        }
    } catch (e) { }

    // 8. exam_backups
    try {
        const backups = sqlite.prepare('SELECT * FROM exam_backups').all();
        console.log(`Migrating ${backups.length} backups...`);
        for (const b of backups) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO exam_backups (id, exam_id, exam_title, course, backup_data, total_submissions, total_questions, created_by, created_at, backup_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO NOTHING
            `, b.id, b.exam_id ? b.exam_id.toString() : null, b.exam_title, b.course, b.backup_data, b.total_submissions, b.total_questions, b.created_by, toDate(b.created_at), b.backup_type);
        }
    } catch (e) { }

    // Updates seq limits for auto-increments
    try {
        const tables = ['exam_groups', 'exam_sections', 'questions', 'submissions', 'activity_logs', 'exam_backups'];
        for (const table of tables) {
            await prisma.$executeRawUnsafe(`SELECT setval('"${table}_id_seq"', COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`);
        }
    } catch (e) {
        console.log('Sequence update error', e);
    }

    console.log('Migration Complete!');
    await prisma.$disconnect();
}

migrate().catch(e => {
    console.error(e);
    process.exit(1);
});
