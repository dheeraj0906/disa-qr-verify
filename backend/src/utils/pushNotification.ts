interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  badge?: number;
}

export async function sendPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });
  } catch {
    // Push failures are non-fatal — log in production, ignore here
  }
}

export async function sendToVerifiers(
  pool: import('pg').Pool,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const { rows } = await pool.query<{ expo_push_token: string }>(
      `SELECT expo_push_token FROM users
       WHERE role IN ('verifier','super_admin') AND expo_push_token IS NOT NULL`
    );

    const messages: PushMessage[] = rows
      .filter((r) => r.expo_push_token.startsWith('ExponentPushToken['))
      .map((r) => ({
        to: r.expo_push_token,
        title,
        body,
        sound: 'default',
        data: { type: 'new_task', ...data },
      }));

    await sendPush(messages);
  } catch {}
}
