import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ktpDataTable } from '../db/schema';
import { type KtpExtractionInput } from '../schema';
import { extractKtpData } from '../handlers/extract_ktp_data';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: KtpExtractionInput = {
  user_id: 1,
  image_data: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
};

describe('extractKtpData', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should extract and save KTP data successfully', async () => {
    // Create prerequisite user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashed_password',
      full_name: 'Test User',
      phone: '081234567890',
      is_verified: true
    }).execute();

    const result = await extractKtpData(testInput);

    // Verify returned data structure
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(1);
    expect(result.nik).toEqual('3201234567890123');
    expect(result.full_name).toEqual('BUDI SANTOSO');
    expect(result.place_of_birth).toEqual('JAKARTA');
    expect(result.date_of_birth).toBeInstanceOf(Date);
    expect(result.gender).toEqual('M');
    expect(result.address).toEqual('JL. MERDEKA NO. 123 RT 001/002');
    expect(result.rt_rw).toEqual('001/002');
    expect(result.village).toEqual('MENTENG');
    expect(result.district).toEqual('MENTENG');
    expect(result.regency).toEqual('JAKARTA PUSAT');
    expect(result.province).toEqual('DKI JAKARTA');
    expect(result.religion).toEqual('ISLAM');
    expect(result.marital_status).toEqual('SINGLE');
    expect(result.occupation).toEqual('KARYAWAN SWASTA');
    expect(result.nationality).toEqual('WNI');
    expect(result.valid_until).toEqual('SEUMUR HIDUP');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save KTP data to database', async () => {
    // Create prerequisite user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashed_password',
      full_name: 'Test User'
    }).execute();

    const result = await extractKtpData(testInput);

    // Verify data is saved in database
    const ktpData = await db.select()
      .from(ktpDataTable)
      .where(eq(ktpDataTable.id, result.id))
      .execute();

    expect(ktpData).toHaveLength(1);
    expect(ktpData[0].user_id).toEqual(1);
    expect(ktpData[0].nik).toEqual('3201234567890123');
    expect(ktpData[0].full_name).toEqual('BUDI SANTOSO');
    expect(ktpData[0].gender).toEqual('M');
    expect(ktpData[0].marital_status).toEqual('SINGLE');
    expect(ktpData[0].created_at).toBeInstanceOf(Date);
    // Note: date_of_birth from database is stored as string, but handler returns Date object
    expect(ktpData[0].date_of_birth).toEqual('1990-05-15');
  });

  it('should generate different mock data for different users', async () => {
    // Create two users
    await db.insert(usersTable).values([
      {
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        full_name: 'User One'
      },
      {
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        full_name: 'User Two'
      }
    ]).execute();

    // Extract KTP data for both users
    const result1 = await extractKtpData({
      user_id: 1,
      image_data: 'mock_image_data'
    });

    const result2 = await extractKtpData({
      user_id: 2,
      image_data: 'mock_image_data'
    });

    // Verify different data for different users
    expect(result1.nik).toEqual('3201234567890123');
    expect(result1.full_name).toEqual('BUDI SANTOSO');
    expect(result1.gender).toEqual('M');

    expect(result2.nik).toEqual('3273456789012345');
    expect(result2.full_name).toEqual('SITI RAHAYU');
    expect(result2.gender).toEqual('F');
    expect(result2.marital_status).toEqual('MARRIED');
  });

  it('should throw error when user does not exist', async () => {
    // Don't create any users

    await expect(extractKtpData(testInput)).rejects.toThrow(/user not found/i);
  });

  it('should throw error when KTP data already exists for user', async () => {
    // Create user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashed_password',
      full_name: 'Test User'
    }).execute();

    // Create KTP data first time
    await extractKtpData(testInput);

    // Try to create KTP data again for same user
    await expect(extractKtpData(testInput)).rejects.toThrow(/ktp data already exists/i);
  });

  it('should handle valid image data formats', async () => {
    // Create prerequisite user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashed_password',
      full_name: 'Test User'
    }).execute();

    // Test with different image data formats
    const base64Input: KtpExtractionInput = {
      user_id: 1,
      image_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyLli5WFuLm8kXzlI='
    };

    const result = await extractKtpData(base64Input);
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(1);
  });

  it('should verify all required enum values are handled correctly', async () => {
    // Create prerequisite user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashed_password',
      full_name: 'Test User'
    }).execute();

    const result = await extractKtpData(testInput);

    // Verify enum values are valid
    expect(['M', 'F']).toContain(result.gender);
    expect(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).toContain(result.marital_status);
    expect(result.nationality).toEqual('WNI');
  });

  it('should handle date fields correctly', async () => {
    // Create prerequisite user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashed_password',
      full_name: 'Test User'
    }).execute();

    const result = await extractKtpData(testInput);

    // Verify date handling
    expect(result.date_of_birth).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.date_of_birth.getFullYear()).toBe(1990);
    expect(result.date_of_birth.getMonth()).toBe(4); // May (0-indexed)
    expect(result.date_of_birth.getDate()).toBe(15);
  });

  it('should verify unique constraint works correctly', async () => {
    // Create two users
    await db.insert(usersTable).values([
      {
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        full_name: 'User One'
      },
      {
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        full_name: 'User Two'
      }
    ]).execute();

    // Extract KTP data for first user
    const result1 = await extractKtpData({
      user_id: 1,
      image_data: 'mock_image_data'
    });
    expect(result1.id).toBeDefined();

    // Extract KTP data for second user (should work)
    const result2 = await extractKtpData({
      user_id: 2,
      image_data: 'mock_image_data'
    });
    expect(result2.id).toBeDefined();
    expect(result2.id).not.toEqual(result1.id);

    // Try to extract KTP data for first user again (should fail)
    await expect(extractKtpData({
      user_id: 1,
      image_data: 'mock_image_data'
    })).rejects.toThrow(/ktp data already exists/i);
  });
});