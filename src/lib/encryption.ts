import CryptoJS from 'crypto-js';

const KEY = process.env.ENCRYPTION_KEY || 'default_key_32_chars_long_1234567';

export const encrypt = (text: string): string => {
    return CryptoJS.AES.encrypt(text, KEY).toString();
};

export const decrypt = (cipherText: string): string => {
    const bytes = CryptoJS.AES.decrypt(cipherText, KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
};
