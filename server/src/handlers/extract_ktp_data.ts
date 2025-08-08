import { db } from '../db';
import { ktpDataTable, usersTable } from '../db/schema';
import { type KtpExtractionInput, type KtpData } from '../schema';
import { eq } from 'drizzle-orm';

export const extractKtpData = async (input: KtpExtractionInput): Promise<KtpData> => {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Check if user already has KTP data (unique constraint)
    const existingKtp = await db.select()
      .from(ktpDataTable)
      .where(eq(ktpDataTable.user_id, input.user_id))
      .execute();

    if (existingKtp.length > 0) {
      throw new Error('KTP data already exists for this user');
    }

    // In a real implementation, this would process the image_data:
    // 1. Decode base64 image or read from file path
    // 2. Use OCR service (Google Vision, Tesseract, etc.) to extract text
    // 3. Parse extracted text using regex patterns for Indonesian KTP format
    // 4. Validate extracted data format (NIK format, dates, etc.)
    
    // For now, simulate OCR extraction with mock data based on user_id
    const mockKtpData = generateMockKtpData(input.user_id);

    // Insert KTP data into database
    const result = await db.insert(ktpDataTable)
      .values({
        user_id: input.user_id,
        nik: mockKtpData.nik,
        full_name: mockKtpData.full_name,
        place_of_birth: mockKtpData.place_of_birth,
        date_of_birth: mockKtpData.date_of_birth,
        gender: mockKtpData.gender,
        address: mockKtpData.address,
        rt_rw: mockKtpData.rt_rw,
        village: mockKtpData.village,
        district: mockKtpData.district,
        regency: mockKtpData.regency,
        province: mockKtpData.province,
        religion: mockKtpData.religion,
        marital_status: mockKtpData.marital_status,
        occupation: mockKtpData.occupation,
        nationality: mockKtpData.nationality,
        valid_until: mockKtpData.valid_until
      })
      .returning()
      .execute();

    // Convert date strings back to Date objects for the response
    const ktpRecord = result[0];
    return {
      ...ktpRecord,
      date_of_birth: new Date(ktpRecord.date_of_birth),
      created_at: ktpRecord.created_at
    };
  } catch (error) {
    console.error('KTP data extraction failed:', error);
    throw error;
  }
};

// Mock OCR extraction function - in real implementation this would process actual image
const generateMockKtpData = (userId: number) => {
  // Generate different mock data based on user ID for testing variety
  const variations = [
    {
      nik: '3201234567890123',
      full_name: 'BUDI SANTOSO',
      place_of_birth: 'JAKARTA',
      date_of_birth: '1990-05-15',
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
    },
    {
      nik: '3273456789012345',
      full_name: 'SITI RAHAYU',
      place_of_birth: 'BANDUNG',
      date_of_birth: '1985-08-20',
      gender: 'F' as const,
      address: 'JL. ASIA AFRIKA NO. 456 RT 003/004',
      rt_rw: '003/004',
      village: 'BABAKAN CIAMIS',
      district: 'SUMUR BANDUNG',
      regency: 'KOTA BANDUNG',
      province: 'JAWA BARAT',
      religion: 'ISLAM',
      marital_status: 'MARRIED' as const,
      occupation: 'GURU',
      nationality: 'WNI',
      valid_until: 'SEUMUR HIDUP'
    }
  ];

  // Use modulo but ensure user_id 1 gets first variation, user_id 2 gets second
  const index = (userId - 1) % variations.length;
  return variations[index];
};