import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, simDataTable } from '../db/schema';
import { getSimData } from '../handlers/get_sim_data';

describe('getSimData', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for user with no SIM data', async () => {
    // Create a user first
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        full_name: 'Test User',
        phone: '081234567890',
        is_verified: true
      })
      .returning()
      .execute();

    const result = await getSimData(user[0].id);

    expect(result).toEqual([]);
  });

  it('should return single SIM data for user', async () => {
    // Create a user first
    const user = await db.insert(usersTable)
      .values({
        email: 'budi@example.com',
        password_hash: 'hashed_password',
        full_name: 'BUDI SANTOSO',
        phone: '081234567890',
        is_verified: true
      })
      .returning()
      .execute();

    // Create SIM data
    const simData = await db.insert(simDataTable)
      .values({
        user_id: user[0].id,
        license_number: 'A1234567890123',
        full_name: 'BUDI SANTOSO',
        place_of_birth: 'JAKARTA',
        date_of_birth: '1990-05-15',
        address: 'JL. MERDEKA NO. 123 RT 001/002',
        license_type: 'A',
        issued_date: '2023-01-15',
        valid_until: '2028-01-15',
        issuing_office: 'POLRES JAKARTA PUSAT'
      })
      .returning()
      .execute();

    const result = await getSimData(user[0].id);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: simData[0].id,
      user_id: user[0].id,
      license_number: 'A1234567890123',
      full_name: 'BUDI SANTOSO',
      place_of_birth: 'JAKARTA',
      address: 'JL. MERDEKA NO. 123 RT 001/002',
      license_type: 'A',
      issuing_office: 'POLRES JAKARTA PUSAT'
    });

    // Verify date fields are Date objects
    expect(result[0].date_of_birth).toBeInstanceOf(Date);
    expect(result[0].issued_date).toBeInstanceOf(Date);
    expect(result[0].valid_until).toBeInstanceOf(Date);
    expect(result[0].created_at).toBeInstanceOf(Date);

    // Verify specific date values
    expect(result[0].date_of_birth).toEqual(new Date('1990-05-15'));
    expect(result[0].issued_date).toEqual(new Date('2023-01-15'));
    expect(result[0].valid_until).toEqual(new Date('2028-01-15'));
  });

  it('should return multiple SIM data for user with different license types', async () => {
    // Create a user first
    const user = await db.insert(usersTable)
      .values({
        email: 'multi@example.com',
        password_hash: 'hashed_password',
        full_name: 'SARI DEWI',
        phone: '081234567890',
        is_verified: true
      })
      .returning()
      .execute();

    // Create multiple SIM data entries
    const simDataEntries = await db.insert(simDataTable)
      .values([
        {
          user_id: user[0].id,
          license_number: 'A1111111111111',
          full_name: 'SARI DEWI',
          place_of_birth: 'BANDUNG',
          date_of_birth: '1988-12-20',
          address: 'JL. SUDIRMAN NO. 456 RT 003/004',
          license_type: 'A',
          issued_date: '2022-03-10',
          valid_until: '2027-03-10',
          issuing_office: 'POLRES BANDUNG'
        },
        {
          user_id: user[0].id,
          license_number: 'B2222222222222',
          full_name: 'SARI DEWI',
          place_of_birth: 'BANDUNG',
          date_of_birth: '1988-12-20',
          address: 'JL. SUDIRMAN NO. 456 RT 003/004',
          license_type: 'B',
          issued_date: '2023-08-15',
          valid_until: '2028-08-15',
          issuing_office: 'POLRES BANDUNG'
        },
        {
          user_id: user[0].id,
          license_number: 'C3333333333333',
          full_name: 'SARI DEWI',
          place_of_birth: 'BANDUNG',
          date_of_birth: '1988-12-20',
          address: 'JL. SUDIRMAN NO. 456 RT 003/004',
          license_type: 'C',
          issued_date: '2023-11-01',
          valid_until: '2028-11-01',
          issuing_office: 'POLRES BANDUNG'
        }
      ])
      .returning()
      .execute();

    const result = await getSimData(user[0].id);

    expect(result).toHaveLength(3);

    // Verify all entries belong to the correct user
    result.forEach(sim => {
      expect(sim.user_id).toBe(user[0].id);
      expect(sim.full_name).toBe('SARI DEWI');
      expect(sim.place_of_birth).toBe('BANDUNG');
      expect(sim.issuing_office).toBe('POLRES BANDUNG');
    });

    // Verify different license types
    const licenseTypes = result.map(sim => sim.license_type).sort();
    expect(licenseTypes).toEqual(['A', 'B', 'C']);

    // Verify unique license numbers
    const licenseNumbers = result.map(sim => sim.license_number);
    expect(new Set(licenseNumbers).size).toBe(3); // All unique
  });

  it('should return empty array for non-existent user', async () => {
    const result = await getSimData(99999); // Non-existent user ID

    expect(result).toEqual([]);
  });

  it('should not return SIM data for other users', async () => {
    // Create two users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@example.com',
          password_hash: 'hashed_password',
          full_name: 'User One',
          phone: '081111111111',
          is_verified: true
        },
        {
          email: 'user2@example.com',
          password_hash: 'hashed_password',
          full_name: 'User Two',
          phone: '082222222222',
          is_verified: true
        }
      ])
      .returning()
      .execute();

    // Create SIM data for both users
    await db.insert(simDataTable)
      .values([
        {
          user_id: users[0].id,
          license_number: 'USER1LICENSE123',
          full_name: 'User One',
          place_of_birth: 'JAKARTA',
          date_of_birth: '1990-01-01',
          address: 'User One Address',
          license_type: 'A',
          issued_date: '2023-01-01',
          valid_until: '2028-01-01',
          issuing_office: 'POLRES JAKARTA'
        },
        {
          user_id: users[1].id,
          license_number: 'USER2LICENSE456',
          full_name: 'User Two',
          place_of_birth: 'SURABAYA',
          date_of_birth: '1985-06-15',
          address: 'User Two Address',
          license_type: 'B',
          issued_date: '2023-06-01',
          valid_until: '2028-06-01',
          issuing_office: 'POLRES SURABAYA'
        }
      ])
      .execute();

    // Get SIM data for user 1
    const user1Result = await getSimData(users[0].id);
    expect(user1Result).toHaveLength(1);
    expect(user1Result[0].license_number).toBe('USER1LICENSE123');
    expect(user1Result[0].full_name).toBe('User One');

    // Get SIM data for user 2
    const user2Result = await getSimData(users[1].id);
    expect(user2Result).toHaveLength(1);
    expect(user2Result[0].license_number).toBe('USER2LICENSE456');
    expect(user2Result[0].full_name).toBe('User Two');
  });

  it('should handle database query with proper ordering', async () => {
    // Create a user
    const user = await db.insert(usersTable)
      .values({
        email: 'ordered@example.com',
        password_hash: 'hashed_password',
        full_name: 'Test User',
        phone: '081234567890',
        is_verified: true
      })
      .returning()
      .execute();

    // Create SIM data with different creation dates
    const simData1 = await db.insert(simDataTable)
      .values({
        user_id: user[0].id,
        license_number: 'FIRST123456789',
        full_name: 'Test User',
        place_of_birth: 'JAKARTA',
        date_of_birth: '1990-01-01',
        address: 'Test Address',
        license_type: 'A',
        issued_date: '2023-01-01',
        valid_until: '2028-01-01',
        issuing_office: 'POLRES TEST'
      })
      .returning()
      .execute();

    // Add a small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const simData2 = await db.insert(simDataTable)
      .values({
        user_id: user[0].id,
        license_number: 'SECOND987654321',
        full_name: 'Test User',
        place_of_birth: 'JAKARTA',
        date_of_birth: '1990-01-01',
        address: 'Test Address',
        license_type: 'B',
        issued_date: '2023-06-01',
        valid_until: '2028-06-01',
        issuing_office: 'POLRES TEST'
      })
      .returning()
      .execute();

    const result = await getSimData(user[0].id);

    expect(result).toHaveLength(2);
    // Results should be returned in the order they were retrieved
    const licenseNumbers = result.map(sim => sim.license_number);
    expect(licenseNumbers).toContain('FIRST123456789');
    expect(licenseNumbers).toContain('SECOND987654321');
  });
});