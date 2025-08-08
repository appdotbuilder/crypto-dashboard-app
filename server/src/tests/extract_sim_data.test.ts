import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, simDataTable } from '../db/schema';
import { type SimExtractionInput } from '../schema';
import { extractSimData } from '../handlers/extract_sim_data';
import { eq } from 'drizzle-orm';

// Test input with required fields
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashedpassword123',
  full_name: 'Test User',
  phone: '081234567890'
};

const testInput: SimExtractionInput = {
  user_id: 1,
  image_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/...' // Mock base64 image data
};

describe('extractSimData', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should extract and save SIM data successfully', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testInput, user_id: userId };

    const result = await extractSimData(input);

    // Verify basic properties
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(userId);
    expect(result.license_number).toMatch(/^A\d+$/); // Dynamic license number
    expect(result.full_name).toEqual('BUDI SANTOSO');
    expect(result.place_of_birth).toEqual('JAKARTA');
    expect(result.date_of_birth).toBeInstanceOf(Date);
    expect(result.address).toEqual('JL. MERDEKA NO. 123 RT 001/002');
    expect(result.license_type).toEqual('A');
    expect(result.issued_date).toBeInstanceOf(Date);
    expect(result.valid_until).toBeInstanceOf(Date);
    expect(result.issuing_office).toEqual('POLRES JAKARTA PUSAT');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save SIM data to database', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testInput, user_id: userId };

    const result = await extractSimData(input);

    // Query database to verify data was saved
    const simData = await db.select()
      .from(simDataTable)
      .where(eq(simDataTable.id, result.id))
      .execute();

    expect(simData).toHaveLength(1);
    expect(simData[0].user_id).toEqual(userId);
    expect(simData[0].license_number).toMatch(/^A\d+$/); // Dynamic license number
    expect(simData[0].full_name).toEqual('BUDI SANTOSO');
    expect(simData[0].place_of_birth).toEqual('JAKARTA');
    // Database returns date strings, so check the string format
    expect(simData[0].date_of_birth).toEqual('1990-05-15');
    expect(simData[0].address).toEqual('JL. MERDEKA NO. 123 RT 001/002');
    expect(simData[0].license_type).toEqual('A');
    expect(simData[0].issued_date).toEqual('2023-01-15');
    expect(simData[0].valid_until).toEqual('2028-01-15');
    expect(simData[0].issuing_office).toEqual('POLRES JAKARTA PUSAT');
    expect(simData[0].created_at).toBeInstanceOf(Date);
  });

  it('should fail when user does not exist', async () => {
    const input = { ...testInput, user_id: 999 }; // Non-existent user ID

    await expect(extractSimData(input)).rejects.toThrow(/User with ID 999 not found/i);
  });

  it('should fail when image_data is empty', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { user_id: userId, image_data: '' };

    await expect(extractSimData(input)).rejects.toThrow(/Image data is required for SIM extraction/i);
  });

  it('should fail when image_data is only whitespace', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { user_id: userId, image_data: '   ' };

    await expect(extractSimData(input)).rejects.toThrow(/Image data is required for SIM extraction/i);
  });

  it('should handle different image data formats', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Test with file path format
    const filePathInput = { user_id: userId, image_data: '/path/to/sim/image.jpg' };
    const result1 = await extractSimData(filePathInput);
    expect(result1.license_number).toMatch(/^A\d+$/); // Dynamic license number

    // Test with different base64 format
    const base64Input = { user_id: userId, image_data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' };
    const result2 = await extractSimData(base64Input);
    expect(result2.license_number).toMatch(/^A\d+$/); // Dynamic license number
    
    // Verify they are different license numbers
    expect(result1.license_number).not.toEqual(result2.license_number);
  });

  it('should allow multiple SIM records for same user', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testInput, user_id: userId };

    // Extract SIM data twice for the same user
    const result1 = await extractSimData(input);
    const result2 = await extractSimData({ ...input, image_data: 'different_image_data' });

    // Both should succeed (users can have multiple SIM cards)
    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.user_id).toEqual(userId);
    expect(result2.user_id).toEqual(userId);
    
    // Verify they have different license numbers
    expect(result1.license_number).not.toEqual(result2.license_number);
    expect(result1.license_number).toMatch(/^A\d+$/);
    expect(result2.license_number).toMatch(/^A\d+$/);

    // Verify both records exist in database
    const simRecords = await db.select()
      .from(simDataTable)
      .where(eq(simDataTable.user_id, userId))
      .execute();

    expect(simRecords).toHaveLength(2);
  });

  it('should maintain data integrity with proper date handling', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const input = { ...testInput, user_id: userId };

    const result = await extractSimData(input);

    // Verify date fields are proper Date objects
    expect(result.date_of_birth).toBeInstanceOf(Date);
    expect(result.issued_date).toBeInstanceOf(Date);
    expect(result.valid_until).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify date relationships make sense
    expect(result.issued_date.getTime()).toBeLessThan(result.valid_until.getTime());
    expect(result.date_of_birth.getTime()).toBeLessThan(result.issued_date.getTime());
  });
});