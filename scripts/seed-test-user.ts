#!/usr/bin/env tsx

/**
 * Seed Test User for E2E Tests
 *
 * Creates a test user account that can be used for automated E2E testing
 * without requiring manual authentication.
 *
 * Usage:
 *   npm run db:seed-test-user
 */

// CRITICAL: Load environment variables BEFORE any imports that use them
// This must be at the very top to prevent import hoisting issues
import { config } from 'dotenv';
config({ path: '.env.local' });

// Now safe to import modules that use process.env
import { query, queryOne } from '../lib/db';

const TEST_USER = {
  email: 'e2e-test@example.com',
  username: 'E2E Test User',
};

async function seedTestUser() {
  console.log('🌱 Seeding test user for E2E tests...\n');

  try {
    // Check if test user already exists
    const existingUser = await queryOne<{ id: string; email: string; username: string }>(
      'SELECT id, email, username FROM users WHERE email = $1',
      [TEST_USER.email]
    );

    if (existingUser) {
      console.log('✅ Test user already exists:');
      console.log(`   ID:       ${existingUser.id}`);
      console.log(`   Email:    ${existingUser.email}`);
      console.log(`   Username: ${existingUser.username}\n`);
      return existingUser;
    }

    // Create test user
    const newUser = await queryOne<{ id: string; email: string; username: string }>(
      'INSERT INTO users (email, username) VALUES ($1, $2) RETURNING id, email, username',
      [TEST_USER.email, TEST_USER.username]
    );

    if (!newUser) {
      throw new Error('Failed to create test user');
    }

    console.log('✅ Test user created successfully:');
    console.log(`   ID:       ${newUser.id}`);
    console.log(`   Email:    ${newUser.email}`);
    console.log(`   Username: ${newUser.username}\n`);

    // Create some sample habits for testing
    console.log('🌱 Creating sample habits...');

    const sampleHabits = [
      {
        name: 'Morning Exercise',
        type: 'boolean',
        target_value: null,
        sort_order: 0,
      },
      {
        name: 'Drink Water',
        type: 'count',
        target_value: 8,
        sort_order: 1,
      },
      {
        name: 'Read Books',
        type: 'time',
        target_value: 1800, // 30 minutes in seconds
        sort_order: 2,
      },
    ];

    for (const habit of sampleHabits) {
      await query(
        `INSERT INTO habits (user_id, name, type, target_value, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [newUser.id, habit.name, habit.type, habit.target_value, habit.sort_order]
      );
    }

    console.log(`✅ Created ${sampleHabits.length} sample habits\n`);

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Test User Ready!                                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log('Use in E2E tests:');
    console.log(`  await page.request.post('/api/auth/test-login', {`);
    console.log(`    data: { email: '${TEST_USER.email}' }`);
    console.log(`  });\n`);

    return newUser;
  } catch (error) {
    console.error('❌ Error seeding test user:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedTestUser()
    .then(() => {
      console.log('✅ Seeding complete!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seedTestUser, TEST_USER };
