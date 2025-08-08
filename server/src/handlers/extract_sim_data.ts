import { db } from '../db';
import { simDataTable, usersTable } from '../db/schema';
import { type SimExtractionInput, type SimData } from '../schema';
import { eq } from 'drizzle-orm';

export const extractSimData = async (input: SimExtractionInput): Promise<SimData> => {
  try {
    // Verify that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with ID ${input.user_id} not found`);
    }

    // In a real implementation, this would process the image_data with OCR/AI services
    // like Google Vision API, AWS Textract, or Tesseract to extract SIM card text
    // For now, we simulate the extraction process with mock data
    const extractedData = simulateSimExtraction(input.image_data, input.user_id);

    // Insert the extracted SIM data into the database
    const result = await db.insert(simDataTable)
      .values({
        user_id: input.user_id,
        license_number: extractedData.license_number,
        full_name: extractedData.full_name,
        place_of_birth: extractedData.place_of_birth,
        date_of_birth: extractedData.date_of_birth,
        address: extractedData.address,
        license_type: extractedData.license_type,
        issued_date: extractedData.issued_date,
        valid_until: extractedData.valid_until,
        issuing_office: extractedData.issuing_office
      })
      .returning()
      .execute();

    // Convert date strings back to Date objects for return value
    const simData = result[0];
    return {
      ...simData,
      date_of_birth: new Date(simData.date_of_birth),
      issued_date: new Date(simData.issued_date),
      valid_until: new Date(simData.valid_until),
      created_at: new Date(simData.created_at)
    };
  } catch (error) {
    console.error('SIM data extraction failed:', error);
    throw error;
  }
};

// Mock function to simulate OCR/AI extraction
// In production, this would be replaced with actual image processing
function simulateSimExtraction(imageData: string, userId: number) {
  // Basic validation that image_data is provided
  if (!imageData || imageData.trim().length === 0) {
    throw new Error('Image data is required for SIM extraction');
  }

  // Generate unique license number to avoid constraint violations
  const timestamp = Date.now();
  const uniqueLicenseNumber = `A${userId}${timestamp.toString().slice(-8)}`;

  // Mock extracted data - in reality this would come from image processing
  return {
    license_number: uniqueLicenseNumber,
    full_name: 'BUDI SANTOSO',
    place_of_birth: 'JAKARTA',
    date_of_birth: '1990-05-15', // Store as string for date column
    address: 'JL. MERDEKA NO. 123 RT 001/002',
    license_type: 'A', // Motorcycle license
    issued_date: '2023-01-15', // Store as string for date column
    valid_until: '2028-01-15', // Store as string for date column
    issuing_office: 'POLRES JAKARTA PUSAT'
  };
}