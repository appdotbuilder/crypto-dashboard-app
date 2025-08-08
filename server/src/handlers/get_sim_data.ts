import { type SimData } from '../schema';

export const getSimData = async (userId: number): Promise<SimData[]> => {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to fetch all SIM data associated with a user,
    // as users can have multiple driver's licenses (different types).
    return Promise.resolve([
        {
            id: 1,
            user_id: userId,
            license_number: 'A1234567890123',
            full_name: 'BUDI SANTOSO',
            place_of_birth: 'JAKARTA',
            date_of_birth: new Date('1990-05-15'),
            address: 'JL. MERDEKA NO. 123 RT 001/002',
            license_type: 'A', // Motorcycle license
            issued_date: new Date('2023-01-15'),
            valid_until: new Date('2028-01-15'),
            issuing_office: 'POLRES JAKARTA PUSAT',
            created_at: new Date('2023-01-15')
        },
        {
            id: 2,
            user_id: userId,
            license_number: 'B9876543210987',
            full_name: 'BUDI SANTOSO',
            place_of_birth: 'JAKARTA',
            date_of_birth: new Date('1990-05-15'),
            address: 'JL. MERDEKA NO. 123 RT 001/002',
            license_type: 'B', // Car license
            issued_date: new Date('2023-06-10'),
            valid_until: new Date('2028-06-10'),
            issuing_office: 'POLRES JAKARTA PUSAT',
            created_at: new Date('2023-06-10')
        }
    ]);
};