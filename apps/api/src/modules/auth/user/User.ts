import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const USERS_TABLE = 'users';

/**
 * Every column states its type explicitly instead of leaning on the metadata tsc emits:
 * `verbatimModuleSyntax` erases a type-only import, so a type inferred from a signature would
 * depend on how the file happens to import it.
 */
@Entity({ name: USERS_TABLE })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'email', type: 'varchar', length: 320, unique: true })
  email!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Logout moves it to "now", and every token issued earlier stops being accepted at once —
   * revocation without a separate table and without a list to check each request against.
   */
  @Column({ name: 'tokens_valid_from', type: 'timestamptz' })
  tokensValidFrom!: Date;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
