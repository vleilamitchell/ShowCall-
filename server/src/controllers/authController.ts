import { Context } from 'hono';

/**
 * Returns the authenticated user's profile, mirroring the legacy response
 * from /protected/me.
 */
export const me = (c: Context) => {
  const user = c.get('user');
  return c.json({
    user,
    message: 'You are authenticated!',
  });
};


