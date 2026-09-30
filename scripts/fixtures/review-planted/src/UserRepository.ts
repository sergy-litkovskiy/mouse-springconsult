interface Db {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export class UserRepository {
  constructor(private readonly db: Db) {}

  findByEmail(email: string) {
    return this.db.query(`SELECT id, email, name FROM users WHERE email = '${email}'`);
  }

  findById(id: number) {
    return this.db.query('SELECT id, email, name FROM users WHERE id = $1', [id]);
  }
}
