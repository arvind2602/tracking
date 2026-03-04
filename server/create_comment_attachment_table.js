const pool = require('./config/db');

async function createTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "CommentAttachment" (
                "id" UUID NOT NULL DEFAULT gen_random_uuid(),
                "commentId" UUID NOT NULL,
                "name" TEXT NOT NULL,
                "url" TEXT NOT NULL,
                "fileType" TEXT NOT NULL,
                "size" INTEGER,
                CONSTRAINT "CommentAttachment_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "CommentAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "idx_comment_attachment_comment" ON "CommentAttachment"("commentId");
        `);
        console.log('CommentAttachment table created successfully');
        process.exit(0);
    } catch (err) {
        console.error('Error creating table:', err);
        process.exit(1);
    }
}

createTable();
