const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const iconv = require('iconv-lite');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.FRONTEND_URL || "*").split(',');
const io = new Server(server, { cors: { origin: allowedOrigins, methods: ["GET", "POST"] } });

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const randomName = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${randomName}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

const fileUpload = multer({ storage });

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
});
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

const deleteImageFile = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return;

    console.log(`[Image Cleanup] Processing: ${imageUrl}`);

    // Normalize: remove domain if present, ensure it starts with /uploads/
    let relativePath = imageUrl;
    if (imageUrl.includes('/uploads/')) {
        relativePath = imageUrl.substring(imageUrl.indexOf('/uploads/'));
    }

    if (!relativePath.startsWith('/uploads/')) {
        console.log(`[Image Cleanup] Not an internal upload path: ${relativePath}`);
        return;
    }

    const fileName = relativePath.replace('/uploads/', '');
    if (!fileName) return;

    const filePath = path.normalize(path.join(uploadsDir, fileName));

    // Safety check: ensure the file is actually inside the uploads directory
    if (!filePath.startsWith(uploadsDir)) {
        console.warn(`[Image Cleanup] Security Warning: Path traversal attempt blocked: ${filePath}`);
        return;
    }

    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`[Image Cleanup] Deleted file: ${filePath}`);
        } catch (err) {
            console.error(`[Image Cleanup] Error deleting file ${filePath}:`, err.message);
        }
    } else {
        console.log(`[Image Cleanup] File already gone or doesn't exist: ${filePath}`);
    }
};

const isEmailPermitted = (permittedList, userEmail) => {
    if (!Array.isArray(permittedList) || !userEmail) return false;
    const email = userEmail.toLowerCase().trim();

    return permittedList.some(pattern => {
        const p = pattern.toLowerCase().trim();
        if (p.endsWith('*')) {
            const prefix = p.slice(0, -1);
            return email.startsWith(prefix);
        }
        return email === p;
    });
};

const paginateResults = async (queryBase, params, pageInput, limitInput) => {
    const page = parseInt(pageInput) || 1;
    const limit = parseInt(limitInput) || 10;
    const offset = (page - 1) * limit;

    const countResult = await db.prepare(`SELECT COUNT(*) as count FROM (${queryBase}) count_table`).get(...params);
    const total = countResult ? Number(countResult.count) : 0;
    const data = await db.prepare(`${queryBase} LIMIT ? OFFSET ?`).all(...params, limit, offset);

    return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
};

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    // Support token in query for downloads/exports
    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) return res.status(401).json({ error: 'Token missing' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token invalid' });
        req.user = user;
        next();
    });
};

const checkRole = (roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized role' });
    next();
};

// --- AUTH ---
app.post('/api/auth/google', async (req, res) => {
    const { credential, client_id } = req.body;
    try {
        const audience = client_id || process.env.GOOGLE_CLIENT_ID;
        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience });
        const { sub: id, email, name, picture } = ticket.getPayload();

        if (!email) {
            console.error('[Auth] Google ticket missing email address');
            return res.status(400).json({ error: 'Email missing from Google account' });
        }

        // 1. Domain Enforcement (ADMIN_EMAIL is always allowed)
        const isAdminEmail = process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

        if (process.env.ALLOWED_DOMAINS && !isAdminEmail) {
            const allowed = process.env.ALLOWED_DOMAINS.split(',').map(d => d.trim().toLowerCase());
            const userDomain = email.split('@')[1]?.toLowerCase();

            if (!userDomain || !allowed.includes(userDomain)) {
                console.warn(`[Auth] Blocked: ${email} (Domain "${userDomain}" is not in [${allowed.join(', ')}])`);
                return res.status(403).json({ error: 'Email domain not authorized' });
            }
        }

        let user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);

        // 2. Determine Role (Admin Priority)
        let role = 'STUDENT';
        if (isAdminEmail) {
            role = 'ADMIN';
        } else if (!user) {
            // Only checks first user if not already explicitly assigned via ADMIN_EMAIL
            const adminCountResult = await db.prepare("SELECT count(*) as count FROM users WHERE role = 'ADMIN'").get();
            const adminCount = adminCountResult ? Number(adminCountResult.count) : 0;
            if (adminCount === 0) role = 'ADMIN';
        }

        if (!user) {
            console.log(`[Auth] Creating new user: ${email} (${role})`);
            await db.prepare('INSERT INTO users (id, email, name, role, picture) VALUES (?, ?, ?, ?, ?)').run(id, email, name, role, picture);
            user = { id, email, name, role, picture };
        } else {
            // Update existing user details if changed (e.g. name or picture)
            await db.prepare('UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?').run(email, name, picture, id);

            // Priority upgrade if email matches ADMIN_EMAIL
            if (role === 'ADMIN' && user.role !== 'ADMIN') {
                console.log(`[Auth] Upgrading ${email} to ADMIN based on config`);
                await db.prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(id);
                user.role = 'ADMIN';
            }
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user });
    } catch (error) {
        console.error('[Auth Error]', error);
        res.status(400).json({ error: 'Auth failed' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    res.json(await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id));
});

// --- IMAGE UPLOAD ---
app.post('/api/upload/image', authenticateToken, upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
});

app.post('/api/exams/import-questions', authenticateToken, checkRole(['LECTURER', 'ADMIN']), fileUpload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        let workbook;

        if (fileExt === '.csv') {
            const buffer = fs.readFileSync(req.file.path);

            // Basic UTF-8 detection
            let isUtf8 = true;
            try {
                new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            } catch (e) {
                isUtf8 = false;
            }

            if (isUtf8) {
                workbook = XLSX.read(buffer, { type: 'buffer' });
            } else {
                // Fallback to Thai (windows-874)
                const decoded = iconv.decode(buffer, 'win874');
                workbook = XLSX.read(decoded, { type: 'string' });
            }
        } else {
            workbook = XLSX.readFile(req.file.path);
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        const questions = data.map(row => {
            // Find keys regardless of case
            const keys = Object.keys(row);
            const questionKey = keys.find(k => k.trim().toLowerCase() === 'question');

            const question_text = questionKey && row[questionKey] ? row[questionKey].toString().trim() : '';
            const options = [];
            keys.forEach(key => {
                const cleanKey = key.trim().toLowerCase();
                if (cleanKey.startsWith('option')) {
                    const val = row[key];
                    if (val !== undefined && val !== null && val.toString().trim() !== '') {
                        options.push(val.toString().trim());
                    }
                }
            });

            // Collect all answer columns (answer, answer1, answer2, etc.)
            const correct_answers = [];
            keys.forEach(key => {
                const cleanKey = key.trim().toLowerCase();
                if (cleanKey === 'answer' || /^answer\d+$/.test(cleanKey)) {
                    const val = row[key];
                    if (val !== undefined && val !== null && val.toString().trim() !== '') {
                        correct_answers.push(val.toString().trim());
                    }
                }
            });

            // Determine type: checkboxes if multiple answers with options, multiple_choice if single answer with options, short_answer if no options
            let type = 'short_answer';
            if (options.length > 0) {
                type = correct_answers.length > 1 ? 'checkboxes' : 'multiple_choice';
            }

            return {
                type,
                question_text,
                options,
                correct_answers,
                is_required: false,
                image_url: null
            };
        });

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json(questions);
    } catch (err) {
        console.error('[Import Error]', err);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Failed to parse file. Ensure it is a valid CSV or XLSX.' });
    }
});

app.post('/api/exams/generate-questions', authenticateToken, checkRole(['LECTURER', 'ADMIN']), fileUpload.array('files', 10), async (req, res) => {
    const { prompt, language, bloomLevels } = req.body;
    if ((!req.files || req.files.length === 0) && !prompt?.trim()) {
        return res.status(400).json({ error: 'Please provide either a prompt or upload PDF files' });
    }

    try {
        if (!process.env.GEMINI_API_KEY) {
            req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment variables' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const aiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const model = genAI.getGenerativeModel({ model: aiModel });

        let parsedBloomLevels = [];
        try {
            parsedBloomLevels = bloomLevels ? JSON.parse(bloomLevels) : [];
        } catch (e) {
            console.error("Failed to parse bloomLevels", bloomLevels);
        }

        const bloomContext = parsedBloomLevels.length > 0
            ? `The questions should specifically target the following Bloom's Taxonomy levels: ${parsedBloomLevels.join(', ')}.`
            : "";

        const systemPrompt = `You are an AI that generates high-quality exam questions from a document based on the user prompt. 
${bloomContext}
Create multiple-choice, checkboxes, or short-answer questions. 

Follow these rules for question types:
- multiple_choice: Use when there are options and exactly one correct answer.
- checkboxes: Use when there are options and one or more correct answers (multi-select).
- short_answer: Use ONLY if there are NO options. These must be FACTUAL and OBVIOUS questions where the answer is typically a single word or short phrase. DO NOT generate opinion-based or open-ended questions.

Follow these quality guidelines:
1. Balanced Options (MCQ/Checkboxes): Ensure all options (choices) are of similar length and grammatical structure.
2. Avoid Predictability (MCQ/Checkboxes): DO NOT make the correct answer significantly longer or more detailed than the distractors. A common flaw is that the longest option is often the correct one; you must avoid this pattern. 
3. Distractor Quality: Distractors should be plausible and relevant to the content.
4. Accuracy: You MUST provide the strictly correct answer(s) in the "correct_answers" field for every question generated.
5. No Meta-References: The "question_text" should NOT include phrases like "based on the input file", "from the PDF", "according to the document", จากเอกสาร, จากสไลด์, ดังเอกสาร, ดังสไลด์ or any similar references to the source material.
6. Clean Options: The strings in the "options" array should contain ONLY the text of the choice. DO NOT include choice labels such as "ก.", "ข.", "ค.", "ง.", or "A.", "B.", "C.", "D.".

Return ONLY a JSON array of objects with the exact following structure:
[
  {
    "type": "multiple_choice",
    "question_text": "Sample Question",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correct_answers": ["Option 1"],
    "is_required": false,
    "image_url": null
  }
]`;

        const fullPrompt = `${systemPrompt}\n\nLanguage: ${language === 'en' ? 'English' : 'Thai'}\n\nUser Prompt: ${prompt || (language === 'en' ? 'Generate 5 questions from the following text/attached file' : 'สร้างคำถาม 5 ข้อจากเนื้อหาต่อไปนี้/เอกสารที่แนบมา')}`;

        const contentParts = [fullPrompt];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const fileExt = path.extname(file.originalname).toLowerCase();
                if (fileExt !== '.pdf') {
                    req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
                    return res.status(400).json({ error: 'Only PDF files are supported for AI generation' });
                }

                const dataBuffer = fs.readFileSync(file.path);
                contentParts.push({
                    inlineData: {
                        data: dataBuffer.toString("base64"),
                        mimeType: "application/pdf"
                    }
                });
            }

            // Cleanup all files after reading them
            req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
        }

        const result = await model.generateContent(contentParts);
        const responseText = result.response.text();

        let questions;
        try {
            const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            questions = JSON.parse(cleanText);

            // Post-process to fix potential type mismatches from AI
            if (Array.isArray(questions)) {
                questions = questions.map(q => {
                    const hasOptions = Array.isArray(q.options) && q.options.length > 0;
                    const multipleCorrect = Array.isArray(q.correct_answers) && q.correct_answers.length > 1;

                    if (hasOptions) {
                        if (multipleCorrect) {
                            q.type = 'checkboxes';
                        } else {
                            q.type = 'multiple_choice';
                        }
                    } else {
                        q.type = 'short_answer';
                        q.options = [];
                    }
                    return q;
                });
            }
        } catch (e) {
            console.error("Failed to parse AI response", responseText);
            return res.status(500).json({ error: 'AI generated invalid JSON. Try changing the prompt.' });
        }

        res.json(questions);
    } catch (err) {
        console.error('[Generate Questions Error]', err);
        if (req.files) {
            req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
        }
        res.status(500).json({ error: 'Failed to generate questions. Ensure valid PDF and API key.' });
    }
});

// --- EXAMS ---
app.post('/api/exams', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const { title, course, duration_minutes, start_time, sections, is_public, permitted_emails, shuffle_questions, shuffle_options, show_score, group_id, allow_late_submission, start_method, theme_config, show_in_dashboard, enable_video_proctoring } = req.body;

    const numericGroupId = group_id ? Number(group_id) : null;
    if (numericGroupId) {
        const group = await db.prepare('SELECT created_by FROM exam_groups WHERE id = ?').get(numericGroupId);
        if (!group || (req.user.role !== 'ADMIN' && group.created_by !== req.user.id)) {
            return res.status(403).json({ error: 'Invalid group selection' });
        }
    }

    await db.transaction(async () => {
        const status = start_method === 'manual' ? 'closed' : 'active';
        const generatedExamId = (Math.floor(1000000000 + Math.random() * 9000000000)).toString();
        const result = await db.prepare(`
        INSERT INTO exams (id, title, course, duration_minutes, start_time, created_by, is_public, permitted_emails, shuffle_questions, shuffle_options, show_score, group_id, allow_late_submission, start_method, status, theme_config, show_in_dashboard, enable_video_proctoring)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
            generatedExamId, title, course, duration_minutes, start_time || null, req.user.id,
            is_public ? 1 : 0, JSON.stringify(permitted_emails),
            shuffle_questions ? 1 : 0, shuffle_options ? 1 : 0, show_score ? 1 : 0,
            numericGroupId, allow_late_submission ? 1 : 0, start_method || 'auto',
            status, JSON.stringify(theme_config || null), show_in_dashboard ? 1 : 0,
            enable_video_proctoring ? 1 : 0
        );

        const examId = result.lastInsertRowid || generatedExamId;

        if (sections && sections.length > 0) {
            const insertSection = await db.prepare(`INSERT INTO exam_sections (exam_id, title, description, order_index) VALUES (?, ?, ?, ?)`);
            const insertQ = await db.prepare(`INSERT INTO questions (exam_id, type, question_text, options, correct_answers, image_url, is_required, section_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

            for (let sIdx = 0; sIdx < sections.length; sIdx++) {
                const section = sections[sIdx];
                const sectionResult = await insertSection.run(examId, section.title, section.description || '', sIdx);
                const sectionId = sectionResult.lastInsertRowid;

                if (section.questions && section.questions.length > 0) {
                    for (const q of section.questions) {
                        const options = q.type === 'short_answer' ? null : JSON.stringify(q.options || []);
                        await insertQ.run(examId, q.type, q.question_text, options, JSON.stringify(q.correct_answers || []), q.image_url || null, q.is_required ? 1 : 0, sectionId);
                    }
                }
            };
        }
        res.json({ id: examId });
    })();
});

app.get('/api/exams', authenticateToken, async (req, res) => {
    const { page, limit, search, group_id, sortBy, sortOrder, status: statusFilter } = req.query;

    if (req.user.role === 'STUDENT') {
        const exams = await db.prepare(`
                SELECT e.*, g.name as group_name, s.status as submission_status, s.raw_score, s.total_questions
                FROM exams e
                LEFT JOIN exam_groups g ON e.group_id = g.id
                LEFT JOIN submissions s ON e.id = s.exam_id AND s.student_id = ? AND s.status = 'submitted'
            `).all(req.user.id);

        const filtered = exams.filter(e => {
            if (e.submission_status === 'submitted') return true;
            if (e.is_public && e.show_in_dashboard) return true;
            if (e.is_public) return false;
            const emails = JSON.parse(e.permitted_emails || '[]');
            return isEmailPermitted(emails, req.user.email);
        });

        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const start = (p - 1) * l;
        const paginated = filtered.slice(start, start + l);

        return res.json({
            data: paginated,
            total: filtered.length,
            page: p,
            limit: l,
            totalPages: Math.ceil(filtered.length / l)
        });
    } else {
        let query = `
                SELECT e.*, g.name as group_name 
                FROM exams e 
                LEFT JOIN exam_groups g ON e.group_id = g.id
            `;
        let params = [];
        let conditions = [];

        if (req.user.role === 'LECTURER') {
            conditions.push('e.created_by = ?');
            params.push(req.user.id);
        }

        if (search) {
            conditions.push('(e.title LIKE ? OR e.course LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (group_id !== undefined && group_id !== 'all') {
            if (group_id === '0' || group_id === 0) {
                conditions.push('e.group_id IS NULL');
            } else {
                conditions.push('e.group_id = ?');
                params.push(Number(group_id));
            }
        }

        if (statusFilter && statusFilter !== 'ALL') {
            conditions.push('e.status = ?');
            params.push(statusFilter);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        const validSortColumns = ['title', 'course', 'start_time', 'duration_minutes', 'status', 'created_at'];
        const sortCol = validSortColumns.includes(sortBy) ? `e.${sortBy}` : 'e.created_at';
        const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

        query += ` ORDER BY ${sortCol} ${sortDir}`;

        res.json(await paginateResults(query, params, page, limit));
    }
});

app.get('/api/exams/:id', authenticateToken, async (req, res) => {
    const examId = req.params.id;
    const exam = await db.prepare(`
        SELECT e.*, g.name as group_name
        FROM exams e
        LEFT JOIN exam_groups g ON e.group_id = g.id
        WHERE e.id = ?
    `).get(examId);
    if (!exam) return res.status(404).json({ error: 'Not found' });

    // Permission check
    if (req.user.role === 'LECTURER' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (req.user.role === 'STUDENT') {
        const permitted = JSON.parse(exam.permitted_emails || '[]');
        if (!exam.is_public && !isEmailPermitted(permitted, req.user.email)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }

    // Check if student already submitted
    const submission = await db.prepare('SELECT * FROM submissions WHERE exam_id = ? AND student_id = ? AND status = \'submitted\'').get(examId, req.user.id);

    const sections = await db.prepare('SELECT * FROM exam_sections WHERE exam_id = ? ORDER BY order_index').all(examId);
    const questions = await db.prepare('SELECT id, type, question_text, options, correct_answers, image_url, is_required, score, section_id FROM questions WHERE exam_id = ?').all(examId);

    // Hide questions/sections from students if exam hasn't started yet
    let hideQuestions = false;
    if (req.user.role === 'STUDENT') {
        const now = Date.now();
        const startTime = exam.start_time && new Date(exam.start_time).getFullYear() > 2000
            ? new Date(exam.start_time).getTime()
            : null;

        if (exam.start_method === 'manual' && !startTime) {
            hideQuestions = true;
        } else if (exam.start_method === 'auto') {
            if (!startTime || startTime > now) {
                hideQuestions = true;
            }
        }
    }

    // Group questions by section
    const resultSections = hideQuestions ? [] : sections.map(s => {
        const sectionQuestions = questions.filter(q => q.section_id === s.id).map(q => {
            const base = {
                ...q,
                options: q.options ? JSON.parse(q.options) : null,
                is_required: q.is_required === 1
            };
            if (req.user.role === 'STUDENT') {
                delete base.correct_answers;
            } else {
                base.correct_answers = JSON.parse(q.correct_answers || '[]');
            }
            return base;
        });
        return { ...s, questions: sectionQuestions };
    });

    // Handle questions without sections (fallback)
    const ungroupedQuestions = hideQuestions ? [] : questions.filter(q => !q.section_id).map(q => {
        const base = {
            ...q,
            options: q.options ? JSON.parse(q.options) : null,
            is_required: q.is_required === 1
        };
        if (req.user.role === 'STUDENT') {
            delete base.correct_answers;
        } else {
            base.correct_answers = JSON.parse(q.correct_answers || '[]');
        }
        return base;
    });

    res.json({
        ...exam,
        permitted_emails: JSON.parse(exam.permitted_emails || '[]'),
        theme_config: exam.theme_config ? JSON.parse(exam.theme_config) : null,
        sections: resultSections,
        ungrouped_questions: ungroupedQuestions,
        my_submission: submission || null
    });
});

app.patch('/api/exams/:id/status', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const { status, force } = req.body;
    const examId = req.params.id;

    const exam = await db.prepare('SELECT start_time, allow_late_submission, created_by FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (status === 'closed' && !force) {
        if (exam && exam.start_time && exam.allow_late_submission) {
            return res.status(403).json({ error: 'Cannot manually stop exam when late submissions are allowed.' });
        }
    }

    await db.prepare('UPDATE exams SET status = ? WHERE id = ?').run(status, examId);

    if (status === 'closed') {
        io.to(`exam_${examId}`).emit('exam_closed');
    }

    // Auto-backup when exam is closed
    if (status === 'closed') {
        try {
            await createBackup(examId, req.user.id, 'auto');
            console.log(`[Auto-Backup] Backup created for exam ${examId}`);
        } catch (err) {
            console.error(`[Auto-Backup] Failed to create backup for exam ${examId}:`, err);
        }
    }

    res.json({ message: 'Status updated' });
});

app.put('/api/exams/:id', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const { title, course, duration_minutes, start_time, sections, is_public, permitted_emails, shuffle_questions, shuffle_options, show_score, group_id, allow_late_submission, start_method, theme_config, show_in_dashboard, enable_video_proctoring } = req.body;
    const examId = req.params.id;

    const exam = await db.prepare('SELECT created_by FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const numericGroupId = group_id ? Number(group_id) : null;
    if (numericGroupId) {
        const group = await db.prepare('SELECT created_by FROM exam_groups WHERE id = ?').get(numericGroupId);
        if (!group || (req.user.role !== 'ADMIN' && group.created_by !== req.user.id)) {
            return res.status(403).json({ error: 'Invalid group selection' });
        }
    }

    await db.transaction(async () => {
        const status = start_method === 'manual' ? 'closed' : 'active';
        // Update Exam metadata
        await db.prepare(`
        UPDATE exams 
        SET title = ?, course = ?, duration_minutes = ?, start_time = ?, is_public = ?, permitted_emails = ?, shuffle_questions = ?, shuffle_options = ?, show_score = ?, group_id = ?, allow_late_submission = ?, start_method = ?, status = ?, theme_config = ?, show_in_dashboard = ?, enable_video_proctoring = ?
        WHERE id = ?
      `).run(
            title, course, duration_minutes, start_time || null,
            is_public ? 1 : 0, JSON.stringify(permitted_emails),
            shuffle_questions ? 1 : 0, shuffle_options ? 1 : 0, show_score ? 1 : 0,
            numericGroupId, allow_late_submission ? 1 : 0, start_method || 'auto',
            status, JSON.stringify(theme_config || null), show_in_dashboard ? 1 : 0,
            enable_video_proctoring ? 1 : 0, examId
        );

        // Image Cleanup: Find images no longer used
        const currentQs = await db.prepare('SELECT image_url FROM questions WHERE exam_id = ?').all(examId);
        const normalize = (url) => {
            if (!url || typeof url !== 'string') return null;
            if (url.includes('/uploads/')) return url.substring(url.indexOf('/uploads/'));
            return url;
        };

        const existingImages = currentQs.map(q => normalize(q.image_url)).filter(Boolean);
        const incomingQuestions = (sections || []).flatMap(s => s.questions || []);
        const newImages = incomingQuestions.map(q => normalize(q.image_url)).filter(Boolean);
        const abandonedImages = existingImages.filter(url => !newImages.includes(url));
        abandonedImages.forEach(url => deleteImageFile(url));

        // Delete existing sections and questions
        await db.prepare('DELETE FROM questions WHERE exam_id = ?').run(examId);
        await db.prepare('DELETE FROM exam_sections WHERE exam_id = ?').run(examId);

        if (sections && sections.length > 0) {
            const insertSection = await db.prepare(`INSERT INTO exam_sections (exam_id, title, description, order_index) VALUES (?, ?, ?, ?)`);
            const insertQ = await db.prepare(`INSERT INTO questions (exam_id, type, question_text, options, correct_answers, image_url, is_required, score, section_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            for (let sIdx = 0; sIdx < sections.length; sIdx++) {
                const section = sections[sIdx];
                const sectionId = (await insertSection.run(examId, section.title, section.description || '', sIdx)).lastInsertRowid;

                if (section.questions && section.questions.length > 0) {
                    for (const q of section.questions) {
                        const options = q.type === 'short_answer' ? null : JSON.stringify(q.options || []);
                        await insertQ.run(examId, q.type, q.question_text, options, JSON.stringify(q.correct_answers || []), q.image_url || null, q.is_required ? 1 : 0, q.score || 1, sectionId);
                    }
                }
            };
        }
    })();

    res.json({ message: 'Exam updated successfully' });
});

app.delete('/api/exams/:id/submissions', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const examId = req.params.id;

    // Check if exam exists and user has permission (if not admin)
    const exam = await db.prepare('SELECT created_by FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized to reset this exam' });
    }

    // Delete activity logs linked to submissions of this exam
    await db.prepare(`
        DELETE FROM activity_logs 
        WHERE submission_id IN (SELECT id FROM submissions WHERE exam_id = ?)
    `).run(examId);

    // Delete submissions
    await db.prepare('DELETE FROM submissions WHERE exam_id = ?').run(examId);

    res.json({ message: 'All submissions have been reset' });
});

app.post('/api/exams/:id/duplicate', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const originalExamId = req.params.id;
    const original = await db.prepare('SELECT * FROM exams WHERE id = ?').get(originalExamId);
    if (!original) return res.status(404).json({ error: 'Exam not found' });

    if (req.user.role !== 'ADMIN' && original.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized to duplicate this exam' });
    }

    const sections = await db.prepare('SELECT * FROM exam_sections WHERE exam_id = ? ORDER BY order_index').all(originalExamId);
    const questions = await db.prepare('SELECT * FROM questions WHERE exam_id = ?').all(originalExamId);

    await db.transaction(async () => {
        const generatedExamId = (Math.floor(1000000000 + Math.random() * 9000000000)).toString(); // 10 digit random string

        await db.prepare(`
            INSERT INTO exams (id, title, course, term, duration_minutes, start_time, created_by, is_public, permitted_emails, status, shuffle_questions, shuffle_options, show_score, group_id, allow_late_submission, start_method, show_in_dashboard, theme_config, enable_video_proctoring)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            generatedExamId, `${original.title} (Copy)`, original.course, original.term || '', original.duration_minutes, original.start_time || null,
            req.user.id, original.is_public, original.permitted_emails, 'active',
            original.shuffle_questions, original.shuffle_options, original.show_score, original.group_id, original.allow_late_submission, original.start_method, original.show_in_dashboard || 0,
            original.theme_config, original.enable_video_proctoring || 0
        );

        const newExamId = generatedExamId;

        const insertSection = await db.prepare(`INSERT INTO exam_sections (exam_id, title, description, order_index) VALUES (?, ?, ?, ?)`);
        const insertQ = await db.prepare(`INSERT INTO questions (exam_id, type, question_text, options, correct_answers, image_url, is_required, score, section_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        // Map old section IDs to new section IDs for question linking
        const sectionMap = new Map();

        for (const s of sections) {
            const result = await insertSection.run(newExamId, s.title, s.description, s.order_index);
            const newSectionId = result.lastInsertRowid;
            sectionMap.set(s.id, newSectionId);
        }

        for (const q of questions) {
            const newSectionIdForQ = q.section_id ? sectionMap.get(q.section_id) : null;
            await insertQ.run(newExamId, q.type, q.question_text, q.options, q.correct_answers, q.image_url, q.is_required, q.score || 1, newSectionIdForQ);
        }
    })();

    res.json({ message: 'Exam duplicated successfully' });
});

app.get('/api/exams/:id/export', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const examId = req.params.id;
    const exam = await db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Not found' });

    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const dbSections = await db.prepare('SELECT id, title, description, order_index FROM exam_sections WHERE exam_id = ? ORDER BY order_index').all(examId);
    const questions = await db.prepare('SELECT type, question_text, options, correct_answers, image_url, is_required, score, section_id FROM questions WHERE exam_id = ?').all(examId);

    const fullSections = dbSections.map(s => ({
        title: s.title,
        description: s.description,
        order_index: s.order_index,
        questions: questions.filter(q => q.section_id === s.id).map(q => ({
            type: q.type,
            question_text: q.question_text,
            options: q.options ? JSON.parse(q.options) : null,
            correct_answers: JSON.parse(q.correct_answers || '[]'),
            image_url: q.image_url,
            is_required: q.is_required === 1,
            score: q.score || 1
        }))
    }));

    const ungrouped = questions.filter(q => !q.section_id).map(q => ({
        type: q.type,
        question_text: q.question_text,
        options: q.options ? JSON.parse(q.options) : null,
        correct_answers: JSON.parse(q.correct_answers || '[]'),
        image_url: q.image_url,
        is_required: q.is_required === 1,
        score: q.score || 1
    }));

    const exportData = {
        title: exam.title,
        course: exam.course,
        term: exam.term,
        duration_minutes: exam.duration_minutes,
        is_public: exam.is_public === 1,
        permitted_emails: JSON.parse(exam.permitted_emails || '[]'),
        shuffle_questions: exam.shuffle_questions === 1,
        shuffle_options: exam.shuffle_options === 1,
        show_score: exam.show_score === 1,
        allow_late_submission: exam.allow_late_submission === 1,
        start_method: exam.start_method,
        theme_config: exam.theme_config ? JSON.parse(exam.theme_config) : null,
        enable_video_proctoring: exam.enable_video_proctoring === 1,
        sections: fullSections,
        ungrouped_questions: ungrouped
    };

    res.setHeader('Content-disposition', `attachment; filename=exam_${examId}_export.json`);
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(exportData, null, 2));
});

app.post('/api/exams/import-exam', authenticateToken, checkRole(['LECTURER', 'ADMIN']), fileUpload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        const data = JSON.parse(fileContent);
        fs.unlinkSync(req.file.path);

        const generatedExamId = (Math.floor(1000000000 + Math.random() * 9000000000)).toString();

        let finalExamId;
        await db.transaction(async () => {
            console.log(`[Import] Starting import for exam: ${data.title}`);
            const result = await db.prepare(`
                INSERT INTO exams (id, title, course, term, duration_minutes, created_by, is_public, permitted_emails, shuffle_questions, shuffle_options, show_score, allow_late_submission, start_method, status, theme_config, show_in_dashboard, enable_video_proctoring)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                generatedExamId,
                data.title || 'Imported Exam',
                data.course || 'Unknown Course',
                data.term || '',
                Number(data.duration_minutes) || 60,
                req.user.id,
                data.is_public ? 1 : 0,
                JSON.stringify(data.permitted_emails || []),
                data.shuffle_questions === false ? 0 : 1,
                data.shuffle_options === false ? 0 : 1,
                data.show_score === false ? 0 : 1,
                data.allow_late_submission ? 1 : 0,
                data.start_method || 'manual',
                'draft',
                data.theme_config ? JSON.stringify(data.theme_config) : null,
                1,
                data.enable_video_proctoring ? 1 : 0
            );

            finalExamId = result.lastInsertRowid || generatedExamId;
            console.log(`[Import] Exam created with ID: ${finalExamId}`);

            const insertSection = await db.prepare(`INSERT INTO exam_sections (exam_id, title, description, order_index) VALUES (?, ?, ?, ?)`);
            const insertQ = await db.prepare(`INSERT INTO questions (exam_id, type, question_text, options, correct_answers, image_url, is_required, score, section_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            if (data.sections && Array.isArray(data.sections)) {
                for (let i = 0; i < data.sections.length; i++) {
                    const s = data.sections[i];
                    const sectionId = (await insertSection.run(finalExamId, s.title, s.description || '', s.order_index || i)).lastInsertRowid;
                    console.log(`[Import] Created section: ${s.title} (ID: ${sectionId})`);
                    if (s.questions && Array.isArray(s.questions)) {
                        for (const q of s.questions) {
                            await insertQ.run(finalExamId, q.type, q.question_text, q.options ? JSON.stringify(q.options) : null, JSON.stringify(q.correct_answers || []), q.image_url || null, q.is_required ? 1 : 0, q.score || 1, sectionId);
                        }
                        console.log(`[Import] Imported ${s.questions.length} questions for section ${s.title}`);
                    }
                }
            }

            if (data.ungrouped_questions && Array.isArray(data.ungrouped_questions)) {
                for (const q of data.ungrouped_questions) {
                    await insertQ.run(finalExamId, q.type, q.question_text, q.options ? JSON.stringify(q.options) : null, JSON.stringify(q.correct_answers || []), q.image_url || null, q.is_required ? 1 : 0, q.score || 1, null);
                }
                console.log(`[Import] Imported ${data.ungrouped_questions.length} ungrouped questions`);
            }
        })();

        res.json({ message: 'Exam imported successfully', examId: finalExamId.toString() });

    } catch (err) {
        console.error('[Import Exam Error]', err);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Failed to import exam: ' + (err.message || 'Unknown error') });
    }
});

app.patch('/api/exams/:id/group', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const examId = req.params.id;
    const exam = await db.prepare('SELECT created_by FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.prepare('UPDATE exams SET group_id = ? WHERE id = ?').run(group_id || null, examId);
    res.json({ message: 'Exam moved to group' });
});

app.post('/api/exams/:id/start', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const examId = req.params.id;
    const exam = await db.prepare('SELECT created_by FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const now = new Date().toISOString();
    await db.prepare("UPDATE exams SET start_time = ?, start_method = 'auto', status = 'active' WHERE id = ?").run(now, examId);
    res.json({ message: 'Exam started', start_time: now });
});

// --- EXAM GROUPS ---
app.get('/api/groups', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const { page, limit, search, sortBy, sortOrder } = req.query;
    let query, params = [];
    let conditions = [];

    if (req.user.role === 'ADMIN') {
        query = `
            SELECT g.*, u.name as creator_name, (SELECT COUNT(*) FROM exams WHERE group_id = g.id) as exam_count
            FROM exam_groups g
            LEFT JOIN users u ON g.created_by = u.id
        `;
    } else {
        query = `
            SELECT g.*, (SELECT COUNT(*) FROM exams WHERE group_id = g.id) as exam_count
            FROM exam_groups g
        `;
        conditions.push('g.created_by = ?');
        params.push(req.user.id);
    }

    if (search) {
        conditions.push('g.name LIKE ?');
        params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    const validSortColumns = ['name', 'exam_count', 'created_at', 'creator_name'];
    const sortCol = validSortColumns.includes(sortBy) ? sortBy : 'g.created_at';
    const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortCol} ${sortDir}`;

    res.json(await paginateResults(query, params, page, limit));
});

app.post('/api/groups', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const { name } = req.body;
    const result = await db.prepare('INSERT INTO exam_groups (name, created_by) VALUES (?, ?)').run(name, req.user.id);
    const id = result.lastInsertRowid;
    res.json({ id, name });
});

app.delete('/api/groups/:id', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const groupId = Number(req.params.id);
    const group = await db.prepare('SELECT created_by FROM exam_groups WHERE id = ?').get(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (req.user.role !== 'ADMIN' && group.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.transaction(async () => {
        await db.prepare('UPDATE exams SET group_id = NULL WHERE group_id = ?').run(groupId);
        await db.prepare('DELETE FROM exam_groups WHERE id = ?').run(groupId);
    })();
    res.json({ message: 'Group deleted' });
});

app.patch('/api/groups/:id', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const { name } = req.body;
    const groupId = Number(req.params.id);
    const group = await db.prepare('SELECT created_by FROM exam_groups WHERE id = ?').get(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (req.user.role !== 'ADMIN' && group.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.prepare('UPDATE exam_groups SET name = ? WHERE id = ?').run(name, groupId);
    res.json({ message: 'Group renamed' });
});

app.delete('/api/exams/:id', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const examId = req.params.id;
    const exam = await db.prepare('SELECT created_by FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    // Only allow creator or ADMIN to delete
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.transaction(async () => {
        // Cleanup images
        const qsWithImages = await db.prepare('SELECT image_url FROM questions WHERE exam_id = ?').all(examId);
        qsWithImages.forEach(q => deleteImageFile(q.image_url));

        await db.prepare('DELETE FROM questions WHERE exam_id = ?').run(examId);
        await db.prepare('DELETE FROM exam_sections WHERE exam_id = ?').run(examId);
        await db.prepare('DELETE FROM activity_logs WHERE submission_id IN (SELECT id FROM submissions WHERE exam_id = ?)').run(examId);
        await db.prepare('DELETE FROM submissions WHERE exam_id = ?').run(examId);
        await db.prepare('DELETE FROM exams WHERE id = ?').run(examId);
    })();

    // Notify active sessions
    io.to(`exam_${req.params.id}`).emit('exam_deleted');

    res.json({ message: 'Exam deleted' });
});


app.post('/api/submissions', authenticateToken, async (req, res) => {
    const exam_id = req.body.exam_id;
    const { answers } = req.body; // answers: { question_id: [selected] }

    // Check if player has already submitted
    const existingSubmission = await db.prepare('SELECT id FROM submissions WHERE exam_id = ? AND student_id = ? AND status = \'submitted\'').get(exam_id, req.user.id);
    if (existingSubmission) {
        return res.status(403).json({ error: 'You have already submitted this exam' });
    }

    const exam = await db.prepare('SELECT start_time, duration_minutes, allow_late_submission, is_public, permitted_emails FROM exams WHERE id = ?').get(exam_id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    if (req.user.role === 'STUDENT') {
        const permitted = JSON.parse(exam.permitted_emails || '[]');
        if (!exam.is_public && !isEmailPermitted(permitted, req.user.email)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }

    const questions = await db.prepare('SELECT id, type, question_text, options, correct_answers, image_url, score FROM questions WHERE exam_id = ?').all(exam_id);

    let rawScore = 0;
    for (const q of questions) {
        const correct = JSON.parse(q.correct_answers || '[]');
        const student = answers[q.id] || [];
        const qScore = q.score || 1;

        if (q.type === 'short_answer' || q.type === 'paragraph') {
            const studentAns = (student[0] || '').trim().toLowerCase();
            if (studentAns && correct.some(c => c.trim().toLowerCase() === studentAns)) {
                rawScore += qScore;
            }
        } else {
            if (correct.length === student.length && correct.every(v => student.includes(v))) {
                rawScore += qScore;
            }
        }
    };

    // Determine final score (Percentage REMOVED as per request, setting to 0)
    const finalScore = 0;

    // Parse questions for storage snapshot
    const snapshotQuestions = questions.map(q => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        correct_answers: JSON.parse(q.correct_answers)
    }));

    const now = new Date();
    const startTime = new Date(exam.start_time);
    const endTime = new Date(startTime.getTime() + exam.duration_minutes * 60000);
    const isLate = now > endTime;

    if (isLate && !exam.allow_late_submission) {
        return res.status(403).json({ error: 'Exam time is over and late submissions are not allowed' });
    }

    const stdId = req.user.email.split('@')[0];

    const ongoing = await db.prepare('SELECT id FROM submissions WHERE exam_id = ? AND student_id = ? AND status = \'ongoing\'').get(exam_id, req.user.id);
    if (ongoing) {
        await db.prepare(`
            UPDATE submissions 
            SET std_id = ?, answers = ?, status = 'submitted', score = ?, raw_score = ?, total_questions = ?, submitted_questions = ?, submitted_at = CURRENT_TIMESTAMP, is_late = ?
            WHERE id = ?
        `).run(stdId, JSON.stringify(answers), finalScore, rawScore, questions.length, JSON.stringify(snapshotQuestions), isLate ? 1 : 0, ongoing.id);
    } else {
        await db.prepare(`
            INSERT INTO submissions (exam_id, student_id, std_id, answers, status, score, raw_score, total_questions, submitted_questions, submitted_at, is_late)
            VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `).run(exam_id, req.user.id, stdId, JSON.stringify(answers), finalScore, rawScore, questions.length, JSON.stringify(snapshotQuestions), isLate ? 1 : 0);
    }

    // Notify monitoring dashboard
    io.to(`exam_${exam_id}`).emit('monitor_update', {
        studentId: req.user.id,
        studentName: req.user.name,
        eventType: 'SUBMITTED',
        score: rawScore,
        totalQuestions: questions.length,
        timestamp: new Date().toISOString()
    });

    // Clear any pending reconnection grace period
    const sessionKey = getSessionKey(req.user.id, String(exam_id));
    if (sessionGracePeriods.has(sessionKey)) {
        clearTimeout(sessionGracePeriods.get(sessionKey));
        sessionGracePeriods.delete(sessionKey);
    }

    // Disconnect the student from monitoring to save resources
    // Find their socket(s) and remove from the exam room
    for (const [socketId, data] of activeStudents.entries()) {
        if (data.studentId === req.user.id && data.examId === String(exam_id)) {
            const studentSocket = io.sockets.sockets.get(socketId);
            if (studentSocket) {
                studentSocket.leave(`exam_${exam_id}`);
            }
            // Mark as submitted so disconnect handler won't broadcast DISCONNECTED
            data.submitted = true;
        }
    }

    res.json({
        score: finalScore,
        raw_score: rawScore,
        total_questions: questions.length
    });
});

app.get('/api/exams/:id/results/export', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const examId = req.params.id;

    const exam = await db.prepare('SELECT created_by FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    // Fetch questions to build dynamic columns
    const questions = await db.prepare(`
        SELECT q.id, q.question_text, es.order_index
        FROM questions q
        LEFT JOIN exam_sections es ON q.section_id = es.id
        WHERE q.exam_id = ?
        ORDER BY es.order_index ASC, q.id ASC
    `).all(examId);

    const submissions = await db.prepare(`
        SELECT s.std_id, s.answers, s.raw_score, s.total_questions, s.submitted_at, u.name as student_name, u.email as student_email
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        WHERE s.exam_id = ? AND s.status = 'submitted'
    `).all(examId);

    // Prepare data for Excel
    const data = submissions.map(s => {
        const row = {
            'Student ID': s.std_id || '',
            'Student Name': s.student_name,
            'Email': s.student_email,
            'Score': s.raw_score,
            'Total Questions': s.total_questions,
            'Submitted At': s.submitted_at
        };

        const answersMap = JSON.parse(s.answers || '{}');
        questions.forEach((q, i) => {
            let ans = answersMap[q.id] || [];
            const ansStr = Array.isArray(ans) ? ans.join('; ') : String(ans);
            row[`Q${i + 1}: ${q.question_text}`] = ansStr;
        });

        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=results_${examId}.xlsx`);
    res.end(buffer);
});

// --- BACKUP HELPER ---
async function createBackup(examId, createdBy, backupType = 'manual') {
    const exam = await db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    if (!exam) return null;

    const sections = await db.prepare('SELECT * FROM exam_sections WHERE exam_id = ? ORDER BY order_index').all(examId);
    const questions = await db.prepare(`
        SELECT q.*, es.order_index
        FROM questions q
        LEFT JOIN exam_sections es ON q.section_id = es.id
        WHERE q.exam_id = ?
        ORDER BY es.order_index ASC, q.id ASC
    `).all(examId);
    const submissions = await db.prepare(`
        SELECT s.*, u.name as student_name, u.email as student_email
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        WHERE s.exam_id = ? AND s.status = 'submitted'
    `).all(examId);

    let activityLogs = [];
    try {
        activityLogs = await db.prepare(`
            SELECT al.*, u.name as student_name, u.email as student_email
            FROM activity_logs al
            JOIN submissions s ON al.submission_id = s.id
            JOIN users u ON s.student_id = u.id
            WHERE s.exam_id = ?
            ORDER BY al.timestamp DESC
        `).all(examId);
    } catch (e) { /* activity_logs may not exist */ }

    const backupData = {
        exam,
        sections,
        questions: questions.map(q => ({
            ...q,
            options: q.options ? JSON.parse(q.options) : [],
            correct_answers: q.correct_answers ? JSON.parse(q.correct_answers) : []
        })),
        submissions: submissions.map(s => ({
            ...s,
            answers: s.answers ? JSON.parse(s.answers) : {}
        })),
        activity_logs: activityLogs,
        exported_at: new Date().toISOString()
    };

    const result = await db.prepare(`
        INSERT INTO exam_backups (exam_id, exam_title, course, backup_data, total_submissions, total_questions, created_by, backup_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        examId, exam.title, exam.course || '',
        JSON.stringify(backupData),
        submissions.length, questions.length,
        createdBy, backupType
    );

    return result.lastInsertRowid;
}

// --- ADMIN & MONITORING ---
app.get('/api/admin/users', authenticateToken, checkRole(['ADMIN']), async (req, res) => {
    const { page, limit, search, role, sortBy, sortOrder } = req.query;
    let query = 'SELECT * FROM users';
    let params = [];
    let conditions = [];

    if (search) {
        conditions.push('(name LIKE ? OR email LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }

    if (role && role !== 'ALL') {
        conditions.push('role = ?');
        params.push(role);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    const validSortColumns = ['name', 'email', 'role', 'registered_at'];
    const sortCol = validSortColumns.includes(sortBy) ? sortBy : 'registered_at';
    const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortCol} ${sortDir}`;

    res.json(await paginateResults(query, params, page, limit));
});

app.patch('/api/admin/users/:id/role', authenticateToken, checkRole(['ADMIN']), async (req, res) => {
    await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(req.body.role, req.params.id);
    res.json({ message: 'Updated' });
});

app.delete('/api/admin/users/:id', authenticateToken, checkRole(['ADMIN']), async (req, res) => {

    // Basic protection against deleting oneself
    if (req.params.id === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    await db.transaction(async () => {
        // Find all submissions by this user
        const submissions = await db.prepare('SELECT id FROM submissions WHERE student_id = ?').all(req.params.id);
        const subIds = submissions.map(s => s.id);

        if (subIds.length > 0) {
            const placeholders = subIds.map(() => '?').join(',');
            await db.prepare(`DELETE FROM activity_logs WHERE submission_id IN (${placeholders})`).run(...subIds);
            await db.prepare(`DELETE FROM submissions WHERE student_id = ?`).run(req.params.id);
        }

        // Cleanup all exams created by this user
        const userExams = await db.prepare('SELECT id FROM exams WHERE created_by = ?').all(req.params.id);
        for (let e of userExams) {
            // Cleanup images
            const qs = await db.prepare('SELECT image_url FROM questions WHERE exam_id = ?').all(e.id);
            for (let q of qs) deleteImageFile(q.image_url);

            // Cleanup activity logs for submissions to this exam
            const examSubmissions = await db.prepare('SELECT id FROM submissions WHERE exam_id = ?').all(e.id);
            const subIds = examSubmissions.map(s => s.id);
            if (subIds.length > 0) {
                const placeholders = subIds.map(() => '?').join(',');
                await db.prepare(`DELETE FROM activity_logs WHERE submission_id IN (${placeholders})`).run(...subIds);
                await db.prepare('DELETE FROM submissions WHERE exam_id = ?').run(e.id);
            }

            await db.prepare('DELETE FROM questions WHERE exam_id = ?').run(e.id);
            await db.prepare('DELETE FROM exam_sections WHERE exam_id = ?').run(e.id);
            await db.prepare('DELETE FROM exams WHERE id = ?').run(e.id);

            // Notify active sessions for each of the user's deleted exams
            io.to(`exam_${e.id}`).emit('exam_deleted');
        }

        await db.prepare('DELETE FROM exam_groups WHERE created_by = ?').run(req.params.id);
        await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    })();

    res.json({ message: 'User deleted' });
});

app.post('/api/admin/bulk-delete', authenticateToken, checkRole(['ADMIN']), async (req, res) => {
    const { type, ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });

    try {
        if (type === 'users') {
            if (ids.includes(req.user.id)) return res.status(400).json({ error: 'Cannot delete yourself' });
            await db.transaction(async () => {
                const placeholders = ids.map(() => '?').join(',');
                const submissions = await db.prepare(`SELECT id FROM submissions WHERE student_id IN (${placeholders})`).all(...ids);
                const subIds = submissions.map(s => s.id);
                if (subIds.length > 0) {
                    const subP = subIds.map(() => '?').join(',');
                    await db.prepare(`DELETE FROM activity_logs WHERE submission_id IN (${subP})`).run(...subIds);
                    await db.prepare(`DELETE FROM submissions WHERE student_id IN (${placeholders})`).run(...ids);
                }

                const userExams = await db.prepare(`SELECT id FROM exams WHERE created_by IN (${placeholders})`).all(...ids);
                for (let e of userExams) {
                    const qs = await db.prepare('SELECT image_url FROM questions WHERE exam_id = ?').all(e.id);
                    for (let q of qs) deleteImageFile(q.image_url);

                    const exSubmissions = await db.prepare('SELECT id FROM submissions WHERE exam_id = ?').all(e.id);
                    const eSubIds = exSubmissions.map(s => s.id);
                    if (eSubIds.length > 0) {
                        const eSubP = eSubIds.map(() => '?').join(',');
                        await db.prepare(`DELETE FROM activity_logs WHERE submission_id IN (${eSubP})`).run(...eSubIds);
                        await db.prepare('DELETE FROM submissions WHERE exam_id = ?').run(e.id);
                    }
                    await db.prepare('DELETE FROM questions WHERE exam_id = ?').run(e.id);
                    await db.prepare('DELETE FROM exam_sections WHERE exam_id = ?').run(e.id);
                    await db.prepare('DELETE FROM exams WHERE id = ?').run(e.id);
                    io.to(`exam_${e.id}`).emit('exam_deleted');
                }

                await db.prepare(`DELETE FROM exam_groups WHERE created_by IN (${placeholders})`).run(...ids);
                await db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...ids);
            })();
        } else if (type === 'exams') {
            const placeholders = ids.map(() => '?').join(',');
            await db.transaction(async () => {
                const qs = await db.prepare(`SELECT image_url FROM questions WHERE exam_id IN (${placeholders})`).all(...ids);
                qs.forEach(q => deleteImageFile(q.image_url));

                await db.prepare(`DELETE FROM questions WHERE exam_id IN (${placeholders})`).run(...ids);
                await db.prepare(`DELETE FROM exam_sections WHERE exam_id IN (${placeholders})`).run(...ids);
                await db.prepare(`DELETE FROM activity_logs WHERE submission_id IN (SELECT id FROM submissions WHERE exam_id IN (${placeholders}))`).run(...ids);
                await db.prepare(`DELETE FROM submissions WHERE exam_id IN (${placeholders})`).run(...ids);
                await db.prepare(`DELETE FROM exams WHERE id IN (${placeholders})`).run(...ids);
            })();
            ids.forEach(id => io.to(`exam_${id}`).emit('exam_deleted'));
        } else if (type === 'groups') {
            const numericIds = ids.map(Number);
            const placeholders = numericIds.map(() => '?').join(',');
            await db.transaction(async () => {
                await db.prepare(`UPDATE exams SET group_id = NULL WHERE group_id IN (${placeholders})`).run(...numericIds);
                await db.prepare(`DELETE FROM exam_groups WHERE id IN (${placeholders})`).run(...numericIds);
            })();
        } else if (type === 'backups') {
            const numericIds = ids.map(Number);
            const placeholders = numericIds.map(() => '?').join(',');
            await db.prepare(`DELETE FROM exam_backups WHERE id IN (${placeholders})`).run(...numericIds);
        }
        res.json({ message: 'Bulk delete successful' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Bulk delete failed' });
    }
});

// --- BACKUP MANAGEMENT ---
app.post('/api/exams/:id/backup', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const examId = req.params.id;
    const exam = await db.prepare('SELECT created_by FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const backupId = await createBackup(examId, req.user.id, 'manual');
        res.json({ message: 'Backup created successfully', id: backupId });
    } catch (err) {
        console.error('[Backup Error]', err);
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

app.get('/api/admin/backups', authenticateToken, checkRole(['ADMIN']), async (req, res) => {
    const { page, limit, search } = req.query;
    let query = 'SELECT id, exam_id, exam_title, course, total_submissions, total_questions, created_by, created_at, backup_type FROM exam_backups';
    let params = [];

    if (search) {
        query += ' WHERE exam_title LIKE ? OR course LIKE ?';
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    res.json(await paginateResults(query, params, page, limit));
});

app.get('/api/admin/backups/:id/download', authenticateToken, checkRole(['ADMIN']), async (req, res) => {
    const backupId = Number(req.params.id);
    const backup = await db.prepare('SELECT * FROM exam_backups WHERE id = ?').get(backupId);
    if (!backup) return res.status(404).json({ error: 'Backup not found' });

    const data = JSON.parse(backup.backup_data);
    const filename = `backup_${backup.exam_title.replace(/[^a-zA-Z0-9]/g, '_')}_${backup.id}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
});

app.delete('/api/admin/backups/:id', authenticateToken, checkRole(['ADMIN']), async (req, res) => {
    const backupId = Number(req.params.id);
    const backup = await db.prepare('SELECT id FROM exam_backups WHERE id = ?').get(backupId);
    if (!backup) return res.status(404).json({ error: 'Backup not found' });

    await db.prepare('DELETE FROM exam_backups WHERE id = ?').run(backupId);
    res.json({ message: 'Backup deleted' });
});

app.get('/api/admin/backups/:id/export-excel', authenticateToken, checkRole(['ADMIN']), async (req, res) => {
    const backupId = Number(req.params.id);
    const backup = await db.prepare('SELECT * FROM exam_backups WHERE id = ?').get(backupId);
    if (!backup) return res.status(404).json({ error: 'Backup not found' });

    const data = JSON.parse(backup.backup_data);
    const questions = data.questions || [];
    const submissions = data.submissions || [];

    // Prepare data for Excel
    const excelData = submissions.map(s => {
        const row = {
            'Student ID': s.std_id || '',
            'Student Name': s.student_name,
            'Email': s.student_email,
            'Score': s.raw_score,
            'Total Questions': s.total_questions,
            'Submitted At': s.submitted_at
        };

        const answersMap = s.answers || {};
        questions.forEach((q, i) => {
            let ans = answersMap[q.id] || [];
            const ansStr = Array.isArray(ans) ? ans.join('; ') : String(ans);
            row[`Q${i + 1}: ${q.question_text}`] = ansStr;
        });

        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `results_backup_${backup.exam_title.replace(/[^a-zA-Z0-9]/g, '_')}_${backup.id}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
});

// --- MANUAL GRADING ---
app.get('/api/exams/:id/review', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const examId = req.params.id;

    const exam = await db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const sections = await db.prepare('SELECT * FROM exam_sections WHERE exam_id = ? ORDER BY order_index').all(examId);
    const questions = await db.prepare(`
        SELECT q.id, q.type, q.question_text, q.options, q.correct_answers, q.image_url, q.section_id, q.score,
               es.title as section_title, es.order_index
        FROM questions q
        LEFT JOIN exam_sections es ON q.section_id = es.id
        WHERE q.exam_id = ?
        ORDER BY es.order_index ASC, q.id ASC
    `).all(examId);

    const submissions = await db.prepare(`
        SELECT s.id, s.student_id, s.std_id, s.answers, s.raw_score, s.total_questions, s.submitted_at,
               u.name as student_name, u.email as student_email, u.picture as student_picture
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        WHERE s.exam_id = ? AND s.status = 'submitted'
        ORDER BY u.name ASC
    `).all(examId);

    res.json({
        exam: {
            id: exam.id,
            title: exam.title,
            course: exam.course,
        },
        sections: sections.map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            order_index: s.order_index,
        })),
        questions: questions.map(q => ({
            ...q,
            options: q.options ? JSON.parse(q.options) : [],
            correct_answers: q.correct_answers ? JSON.parse(q.correct_answers) : [],
            score: q.score || 1,
        })),
        submissions: submissions.map(s => ({
            ...s,
            answers: s.answers ? JSON.parse(s.answers) : {},
        }))
    });
});

app.patch('/api/submissions/:subId/manual-score', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const subId = Number(req.params.subId);
    const { manual_scores } = req.body; // { questionId: score (0 to q.score) }

    const sub = await db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    const exam = await db.prepare('SELECT created_by FROM exams WHERE id = ?').get(sub.exam_id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    // Recalculate raw_score based on manual_scores
    const questions = await db.prepare('SELECT id, type, correct_answers, score FROM questions WHERE exam_id = ?').all(sub.exam_id);
    const answers = JSON.parse(sub.answers || '{}');

    let rawScore = 0;
    for (const q of questions) {
        const qIdStr = String(q.id);
        const qScore = q.score || 1;
        // If there's a manual score for this question, use it (clamped to 0..qScore)
        if (manual_scores && manual_scores[qIdStr] !== undefined) {
            rawScore += Math.min(Math.max(0, Number(manual_scores[qIdStr])), qScore);
        } else {
            // Auto-grade
            const correct = JSON.parse(q.correct_answers || '[]');
            const student = answers[q.id] || [];

            if (q.type === 'short_answer' || q.type === 'paragraph') {
                const studentAns = (student[0] || '').trim().toLowerCase();
                if (studentAns && correct.some(c => c.trim().toLowerCase() === studentAns)) {
                    rawScore += qScore;
                }
            } else {
                if (correct.length === student.length && correct.every(v => student.includes(v))) {
                    rawScore += qScore;
                }
            }
        }
    }

    // Store manual_scores in the answers JSON (as a special key)
    const updatedAnswers = { ...answers, _manual_scores: manual_scores };

    await db.prepare(`
        UPDATE submissions SET raw_score = ?, answers = ? WHERE id = ?
    `).run(rawScore, JSON.stringify(updatedAnswers), subId);

    res.json({ message: 'Score updated', raw_score: rawScore });
});

app.get('/api/lecturer/monitoring/:examId', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const examId = req.params.examId;
    const exam = await db.prepare('SELECT created_by FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(await db.prepare(`
    SELECT al.*, u.name as studentName, u.email as studentEmail
    FROM activity_logs al
    JOIN submissions s ON al.submission_id = s.id
    JOIN users u ON s.student_id = u.id
    WHERE s.exam_id = ? ORDER BY al.timestamp DESC
  `).all(examId));
});

// New Endpoint: Get all participants for an exam
app.get('/api/exams/:id/participants', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const examId = req.params.id;

    const exam = await db.prepare('SELECT created_by FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get all students who have a submission record (ongoing or submitted)
    // We group by student_id and pick the "best" status (submitted > ongoing)
    const participants = await db.prepare(`
        SELECT u.id, u.name, u.email, u.picture, s.status, s.submitted_at, s.raw_score, s.total_questions
        FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY CASE WHEN status = 'submitted' THEN 0 ELSE 1 END, id DESC) as rn
            FROM submissions
            WHERE exam_id = ?
        ) s
        JOIN users u ON s.student_id = u.id
        WHERE s.rn = 1
    `).all(examId);

    // Filter active students for this exam
    const onlineStudentIds = new Set();
    for (const [sid, data] of activeStudents.entries()) {
        if (data.examId === examId) {
            onlineStudentIds.add(data.studentId);
        }
    }
    // Also include those in grace period
    for (const key of sessionGracePeriods.keys()) {
        if (key.endsWith(`_${examId}`)) {
            const sid = key.substring(0, key.length - examId.length - 1);
            onlineStudentIds.add(sid);
        }
    }

    const participantsWithOnline = participants.map(p => ({
        ...p,
        isOnline: onlineStudentIds.has(p.id)
    }));

    res.json(participantsWithOnline);
});

// New Endpoint: Export activity logs
app.get('/api/exams/:id/logs/export', authenticateToken, checkRole(['LECTURER', 'ADMIN']), async (req, res) => {
    const examId = req.params.id;

    const exam = await db.prepare('SELECT created_by FROM exams WHERE id = ?').get(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.user.role !== 'ADMIN' && exam.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const logs = await db.prepare(`
        SELECT al.timestamp, al.event_type, u.name, u.email
        FROM activity_logs al
        JOIN submissions s ON al.submission_id = s.id
        JOIN users u ON s.student_id = u.id
        WHERE s.exam_id = ?
        ORDER BY al.timestamp DESC
    `).all(examId);

    let csv = 'Timestamp,Student Name,Student Email,Event Type\n';
    logs.forEach(log => {
        csv += `"${log.timestamp}","${log.name}","${log.email}","${log.event_type}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=exam_logs_${examId}.csv`);
    res.send('\uFEFF' + csv);
});

// --- SOCKETS ---
const activeStudents = new Map(); // socket.id -> { examId, studentId, studentName, picture, submitted }
const sessionGracePeriods = new Map(); // studentId_examId -> timeoutId

const getSessionKey = (studentId, examId) => `${studentId}_${examId}`;

io.on('connection', (socket) => {
    socket.on('join_exam', ({ examId, studentId, studentName, picture }) => {
        socket.join(`exam_${examId}`);
        if (studentId) {
            // Clear any pending disconnect timeout for this student
            const sessionKey = getSessionKey(studentId, examId);
            if (sessionGracePeriods.has(sessionKey)) {
                clearTimeout(sessionGracePeriods.get(sessionKey));
                sessionGracePeriods.delete(sessionKey);
            }

            // It's a student joining
            activeStudents.set(socket.id, { examId, studentId, studentName, picture });
            io.to(`exam_${examId}`).emit('monitor_update', {
                studentId,
                studentName,
                studentPicture: picture,
                eventType: 'CONNECTED',
                timestamp: new Date().toISOString()
            });
        }
    });

    socket.on('student_activity', async ({ examId, studentId, studentName, picture, eventType }) => {
        const exam_id = examId;
        // Skip activity tracking if student already submitted
        const submitted = await db.prepare('SELECT id FROM submissions WHERE exam_id = ? AND student_id = ? AND status = \'submitted\'').get(exam_id, studentId);
        if (submitted) return;

        const sub = await db.prepare('SELECT id FROM submissions WHERE exam_id = ? AND student_id = ? AND status = \'ongoing\'').get(exam_id, studentId);
        let subId = sub?.id || (await db.prepare('INSERT INTO submissions (exam_id, student_id, status) VALUES (?, ?, \'ongoing\')').run(exam_id, studentId)).lastInsertRowid;
        await db.prepare('INSERT INTO activity_logs (submission_id, event_type) VALUES (?, ?)').run(subId, eventType);
        io.to(`exam_${examId}`).emit('monitor_update', { studentId, studentName, studentPicture: picture, eventType, timestamp: new Date().toISOString() });
    });

    // Allow students to cleanly leave without triggering DISCONNECTED grace period
    socket.on('leave_exam', ({ examId }) => {
        const student = activeStudents.get(socket.id);
        if (student) {
            const sessionKey = getSessionKey(student.studentId, student.examId);
            if (sessionGracePeriods.has(sessionKey)) {
                clearTimeout(sessionGracePeriods.get(sessionKey));
                sessionGracePeriods.delete(sessionKey);
            }
            activeStudents.delete(socket.id);

            // Immediate DISCONNECTED signal when they leave intentionally
            io.to(`exam_${examId}`).emit('monitor_update', {
                studentId: student.studentId,
                studentName: student.studentName,
                studentPicture: student.picture,
                eventType: 'DISCONNECTED',
                timestamp: new Date().toISOString()
            });
        }
        socket.leave(`exam_${examId}`);
    });

    socket.on('request_status_sync', ({ examId }) => {
        // Broadcast to all students in the room to send their status
        io.to(`exam_${examId}`).emit('status_sync_request');
    });

    socket.on('webrtc_signal', (data) => {
        // Relay signaling data to others in the exam room
        // data: { examId, targetId, signal, fromId, fromName }
        socket.to(`exam_${data.examId}`).emit('webrtc_signal', data);
    });

    socket.on('webrtc_ready', (data) => {
        // Notify others (lecturer) that student is ready for WebRTC
        socket.to(`exam_${data.examId}`).emit('webrtc_ready', data);
    });

    socket.on('disconnect', () => {
        const student = activeStudents.get(socket.id);
        if (student) {
            const { studentId, examId, studentName, picture, submitted } = student;
            activeStudents.delete(socket.id);

            // Don't broadcast DISCONNECTED if student already submitted
            if (submitted) return;

            // Check if student has any other active connections (e.g. multiple tabs)
            const otherActiveSocket = Array.from(activeStudents.values()).find(
                s => s.studentId === studentId && s.examId === examId
            );

            if (!otherActiveSocket) {
                // No other active connections, start grace period before showing as offline
                const sessionKey = getSessionKey(studentId, examId);

                // Clear existing timeout if any
                if (sessionGracePeriods.has(sessionKey)) {
                    clearTimeout(sessionGracePeriods.get(sessionKey));
                }

                const timeout = setTimeout(() => {
                    sessionGracePeriods.delete(sessionKey);
                    io.to(`exam_${examId}`).emit('monitor_update', {
                        studentId,
                        studentName,
                        studentPicture: picture,
                        eventType: 'DISCONNECTED',
                        timestamp: new Date().toISOString()
                    });
                }, 60000); // 60 second grace period for reconnection

                sessionGracePeriods.set(sessionKey, timeout);
            }
        }
    });
});

// --- CRON JOBS ---
setInterval(async () => {
    const now = new Date();

    // 1. Auto-Close expired exams
    const activeExams = await db.prepare("SELECT id, start_time, duration_minutes FROM exams WHERE status = 'active' AND allow_late_submission = 0 AND start_time IS NOT NULL").all();

    for (let exam of activeExams) {
        const startTime = new Date(exam.start_time);
        const endTime = new Date(startTime.getTime() + exam.duration_minutes * 60000);

        if (now > endTime) {
            console.log(`[Auto-Close] Closing exam ${exam.id} due to time expiration`);
            await db.prepare("UPDATE exams SET status = 'closed' WHERE id = ?").run(exam.id);
            io.to(`exam_${exam.id}`).emit('exam_closed');
        }
    }

    // 2. Proactive Start Signal (for UI sync)
    // We notify clients when a scheduled exam hits its start time
    const scheduledExams = await db.prepare("SELECT id, start_time FROM exams WHERE status = 'active' AND start_method = 'auto' AND start_time IS NOT NULL").all();
    for (let exam of scheduledExams) {
        const startTime = new Date(exam.start_time);
        // If it started within the last minute, broadcast a signal
        if (now >= startTime && now.getTime() - startTime.getTime() < 65000) {
            io.to(`exam_${exam.id}`).emit('exam_started');
        }
    }
}, 60000); // Check every minute

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server on ${PORT}`);
    if (process.env.ALLOWED_DOMAINS) {
        console.log(`[Config] Allowed Email Domains: ${process.env.ALLOWED_DOMAINS}`);
    } else {
        console.log('[Config] No domain restrictions active (All Google emails allowed)');
    }
    if (process.env.ADMIN_EMAIL) {
        console.log(`[Config] Configured Admin: ${process.env.ADMIN_EMAIL}`);
    }
});
