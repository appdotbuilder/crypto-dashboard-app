import { type KtpData } from '../schema';

export const getKtpData = async (userId: number): Promise<KtpData | null> => {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to fetch KTP data associated with a user,
    // returning null if no KTP data exists for the user.
    return Promise.resolve({
        id: 1,
        user_id: userId,
        nik: '3201234567890123',
        full_name: 'BUDI SANTOSO',
        place_of_birth: 'JAKARTA',
        date_of_birth: new Date('1990-05-15'),
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
        valid_until: 'SEUMUR HIDUP',
        created_at: new Date('2024-01-01')
    });
};