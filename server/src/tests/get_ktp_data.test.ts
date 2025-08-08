import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ktpDataTable } from '../db/schema';
import { getKtpData } from '../handlers/get_ktp_data';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashedpassword123',
  full_name: 'Test User',
  phone: '081234567890',
  is_verified: true
};

const testKtpData = {
  nik: '3201234567890123',
  full_name: 'BUDI SANTOSO',
  place_of_birth: 'JAKARTA',
  date_of_birth: '1990-05-15', // Use string for database insertion
  gender: 'M' as const,
  address: 'JL. MERDEKA NO. 123 RT 001/002',
  rt_rw: '001/002',
  village: 'MENTENG',
  district: 'MENTENG',
  regency: 'JAKARTA PUSAT',
  province: 'DKI JAKARTA',
  religion: 'ISLAM',
  marital_status: 'SINGLE' as const,
  occupation: 'KARYAWAN SWASTA',
  nationality: 'WNI',
  valid_until: 'SEUMUR HIDUP'
};

describe('getKtpData', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return KTP data for existing user', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create KTP data for the user
    await db.insert(ktpDataTable)
      .values({
        user_id: userId,
        ...testKtpData
      })
      .execute();

    // Fetch KTP data
    const result = await getKtpData(userId);

    // Verify the result
    expect(result).not.toBeNull();
    expect(result?.user_id).toEqual(userId);
    expect(result?.nik).toEqual('3201234567890123');
    expect(result?.full_name).toEqual('BUDI SANTOSO');
    expect(result?.place_of_birth).toEqual('JAKARTA');
    expect(result?.date_of_birth).toEqual(new Date('1990-05-15'));
    expect(result?.gender).toEqual('M');
    expect(result?.address).toEqual('JL. MERDEKA NO. 123 RT 001/002');
    expect(result?.rt_rw).toEqual('001/002');
    expect(result?.village).toEqual('MENTENG');
    expect(result?.district).toEqual('MENTENG');
    expect(result?.regency).toEqual('JAKARTA PUSAT');
    expect(result?.province).toEqual('DKI JAKARTA');
    expect(result?.religion).toEqual('ISLAM');
    expect(result?.marital_status).toEqual('SINGLE');
    expect(result?.occupation).toEqual('KARYAWAN SWASTA');
    expect(result?.nationality).toEqual('WNI');
    expect(result?.valid_until).toEqual('SEUMUR HIDUP');
    expect(result?.id).toBeDefined();
    expect(result?.created_at).toBeInstanceOf(Date);
  });

  it('should return null for user without KTP data', async () => {
    // Create test user without KTP data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Fetch KTP data (should be null)
    const result = await getKtpData(userId);

    expect(result).toBeNull();
  });

  it('should return null for non-existent user', async () => {
    const nonExistentUserId = 99999;
    
    const result = await getKtpData(nonExistentUserId);

    expect(result).toBeNull();
  });

  it('should handle date fields correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create KTP data with specific date
    const testDateString = '1985-12-25';
    const expectedDate = new Date('1985-12-25');
    await db.insert(ktpDataTable)
      .values({
        user_id: userId,
        ...testKtpData,
        date_of_birth: testDateString
      })
      .execute();

    const result = await getKtpData(userId);

    expect(result).not.toBeNull();
    expect(result?.date_of_birth).toBeInstanceOf(Date);
    expect(result?.date_of_birth.getTime()).toEqual(expectedDate.getTime());
    expect(result?.created_at).toBeInstanceOf(Date);
  });

  it('should return correct KTP data for multiple users', async () => {
    // Create first user
    const user1Result = await db.insert(usersTable)
      .values({
        ...testUser,
        email: 'user1@example.com'
      })
      .returning()
      .execute();
    const user1Id = user1Result[0].id;

    // Create second user
    const user2Result = await db.insert(usersTable)
      .values({
        ...testUser,
        email: 'user2@example.com'
      })
      .returning()
      .execute();
    const user2Id = user2Result[0].id;

    // Create KTP data for user1
    await db.insert(ktpDataTable)
      .values({
        user_id: user1Id,
        ...testKtpData,
        nik: '3201111111111111'
      })
      .execute();

    // Create KTP data for user2
    await db.insert(ktpDataTable)
      .values({
        user_id: user2Id,
        ...testKtpData,
        nik: '3202222222222222'
      })
      .execute();

    // Fetch KTP data for user1
    const result1 = await getKtpData(user1Id);
    expect(result1).not.toBeNull();
    expect(result1?.user_id).toEqual(user1Id);
    expect(result1?.nik).toEqual('3201111111111111');

    // Fetch KTP data for user2
    const result2 = await getKtpData(user2Id);
    expect(result2).not.toBeNull();
    expect(result2?.user_id).toEqual(user2Id);
    expect(result2?.nik).toEqual('3202222222222222');
  });
});