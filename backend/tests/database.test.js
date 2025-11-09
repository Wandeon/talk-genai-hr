const db = require('../database');
const fs = require('fs');

describe('Database', () => {
  beforeEach(() => {
    if (fs.existsSync('/tmp/test.db')) {
      fs.unlinkSync('/tmp/test.db');
    }
  });

  test('should initialize database with correct schema', async () => {
    await db.initialize('/tmp/test.db');

    const tables = await db.getTables();
    expect(tables).toContain('sessions');
    expect(tables).toContain('messages');
    expect(tables).toContain('tool_calls');
    expect(tables).toContain('images');
  });

  test('should create session', async () => {
    await db.initialize('/tmp/test.db');
    const sessionId = await db.createSession({ userAgent: 'test', ip: '127.0.0.1' });

    expect(sessionId).toBeTruthy();
    const session = await db.getSession(sessionId);
    expect(session.id).toBe(sessionId);
  });
});
