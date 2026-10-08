const BD_MOBILE = /^01[3-9]\d{8}$/;

export class CheckoutValidator {
    /** "+8801712-345678" / "8801712345678" -> "01712345678" */
    static normalizePhone(raw) {
        const digits = String(raw).replace(/[\s\-()]/g, '').replace(/^\+/, '');
        return digits.startsWith('880') ? digits.slice(2) : digits;
    }
    validate({ name, phone, address, bkashNumber }) {
        const errors = {};
        const normalizedName = String(name).trim();
        if (normalizedName.length < 3 || normalizedName.length > 120) errors.name = 'Enter a name between 3 and 120 characters.';
        if (!BD_MOBILE.test(CheckoutValidator.normalizePhone(phone))) errors.phone = 'Enter a valid 11-digit mobile number (01XXXXXXXXX).';
        const normalizedAddress = String(address).trim();
        if (normalizedAddress.length < 10 || normalizedAddress.length > 1000) errors.address = 'Enter a delivery address between 10 and 1000 characters.';
        if (!BD_MOBILE.test(CheckoutValidator.normalizePhone(bkashNumber))) errors.bkashNumber = 'Enter the bKash number you will pay from (01XXXXXXXXX).';
        return errors;
    }
}
