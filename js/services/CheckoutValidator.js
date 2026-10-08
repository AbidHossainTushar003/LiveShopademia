const BD_MOBILE = /^01[3-9]\d{8}$/;

export class CheckoutValidator {
    /** "+8801712-345678" / "8801712345678" -> "01712345678" */
    static normalizePhone(raw) {
        const digits = String(raw).replace(/[\s\-()]/g, '').replace(/^\+/, '');
        return digits.startsWith('880') ? digits.slice(2) : digits;
    }
    validate({ name, phone, address, bkashNumber }) {
        const errors = {};
        if (String(name).trim().length < 3) errors.name = 'Please enter your full name.';
        if (!BD_MOBILE.test(CheckoutValidator.normalizePhone(phone))) errors.phone = 'Enter a valid 11-digit mobile number (01XXXXXXXXX).';
        if (String(address).trim().length < 10) errors.address = 'Please enter your full delivery address.';
        if (!BD_MOBILE.test(CheckoutValidator.normalizePhone(bkashNumber))) errors.bkashNumber = 'Enter the bKash number you will pay from (01XXXXXXXXX).';
        return errors;
    }
}
