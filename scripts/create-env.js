const fs = require('fs');
const content = `DATABASE_URL="mysql://root:firaol%401995@localhost:3306/trading_bot"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="secret_key_123"
ENCRYPTION_KEY="12345678901234567890123456789012"
BYBIT_TESTNET="true"
`;
fs.writeFileSync('.env', content);
console.log('.env created successfully');
