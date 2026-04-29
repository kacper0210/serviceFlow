export const sanitizePhoneNumber = (phone) => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    return digits.slice(-9);
};

export const formatPhoneNumber = (phone) => {
    if (!phone) return "-";
    const clean = sanitizePhoneNumber(phone);
    if (clean.length !== 9) return phone;
    return `+48 ${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
};
