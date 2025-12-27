# Spendwise

A modern expense tracking mobile application built with React Native and Expo.

## Demo Video

<a href="https://drive.google.com/file/d/1RgumKYIjbVxXoOafJl5VI97pkexWm53D/view?usp=drivesdk" target="_blank">Watch Demo Here</a>

---

## Screenshots

<table>
  <tr>
    <td align="center"><img src="screenshots/home.jpg" width="180"/><br><b>Home</b></td>
    <td align="center"><img src="screenshots/expenses.jpg" width="180"/><br><b>Expenses</b></td>
    <td align="center"><img src="screenshots/insights.jpg" width="180"/><br><b>Insights</b></td>
    <td align="center"><img src="screenshots/profile.jpg" width="180"/><br><b>Profile</b></td>
  </tr>
  <tr>
    <td align="center"><img src="screenshots/add-expense.jpg" width="180"/><br><b>Add Expense</b></td>
    <td align="center"><img src="screenshots/edit-expense.jpg" width="180"/><br><b>Edit Expense</b></td>
    <td align="center"><img src="screenshots/login.jpg" width="180"/><br><b>Login</b></td>
    <td align="center"><img src="screenshots/register.jpg" width="180"/><br><b>Register</b></td>
  </tr>
</table>

---

## Key Features

### Expense Management

- Add expenses with amount, category, payment method, description, and date
- Edit existing expenses
- Delete expenses with confirmation
- Built-in calculator for quick amount entry

### Categories

- 10 predefined categories: Food, Transport, Shopping, Entertainment, Bills, Health, Education, Travel, Subscriptions, Other
- Category-based filtering on expenses page
- Visual icons and colors for each category

### Payment Methods

- 6 payment options: Cash, UPI, Credit Card, Debit Card, Net Banking, Wallet
- Filter expenses by payment method

### View Modes

- Daily, Weekly, and Monthly expense views
- Date/week/month navigation with arrows
- Pull-to-refresh functionality

### Insights & Analytics

- Pie chart visualization of spending by category
- Category breakdown with percentages and progress bars
- Historical trend bar charts (Last 7 days / 6 months / 3 years)
- Period comparison tool (compare days, months, or years)
- Click on category to filter expenses

### Settings & Preferences

- Multi-currency support (INR, USD, EUR, GBP, JPY)
- Monthly budget setting
- Carry-over budget toggle
- Theme options: Light, Dark, System

### Offline Support

- Automatically saves expenses offline when network is unavailable
- Auto-sync pending changes when connection is restored
- Graceful error handling with informative messages
- Works seamlessly without manual intervention

### Budget Notifications

- Alerts when exceeding monthly budget
- Warning at 75% and 90% budget usage
- Real-time budget tracking after each expense

### Authentication

- User registration with name, email, password
- Secure login with JWT tokens
- Persistent sessions with AsyncStorage
- Logout functionality

---

## Tech Stack

### Frontend

- React Native with Expo
- Expo Router (file-based routing)
- Redux Toolkit (state management)
- AsyncStorage (local persistence)
- TypeScript

### Backend

- Node.js with Express
- MongoDB with Mongoose
- JWT Authentication
- bcrypt (password hashing)

---

## Project Structure

```
Spendwise/
├── app/
│   ├── (auth)/           # Authentication screens
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── welcome.tsx
│   ├── (main)/           # Main app screens
│   │   ├── home.tsx
│   │   ├── expenses.tsx
│   │   ├── insights.tsx
│   │   ├── profile.tsx
│   │   ├── add-expense.tsx
│   │   └── edit-expense.tsx
│   └── _layout.tsx
├── components/           # Reusable components
├── utils/               # Utilities and API
├── store/               # Redux store
├── server/              # Backend API
│   ├── models/
│   ├── routes/
│   └── server.js
└── screenshots/         # App screenshots
```

---

## Environment Variables

### Frontend (.env)

```env
EXPO_PUBLIC_API_URL=http://YOUR_IP:3000/api
```

| Variable              | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | Backend API base URL. Use your local IP for development. |

### Backend (server/.env)

```env
MONGODB_URI=mongodb://localhost:27017/spendwise
JWT_SECRET=your_secret_key_here
PORT=3000
```

| Variable      | Description                      |
| ------------- | -------------------------------- |
| `MONGODB_URI` | MongoDB connection string        |
| `JWT_SECRET`  | Secret key for JWT token signing |
| `PORT`        | Server port (default: 3000)      |

---

## API Endpoints

### Authentication

| Method | Endpoint             | Description       |
| ------ | -------------------- | ----------------- |
| POST   | `/api/auth/register` | Register new user |
| POST   | `/api/auth/login`    | User login        |

### User

| Method | Endpoint             | Description         |
| ------ | -------------------- | ------------------- |
| GET    | `/api/users/profile` | Get user profile    |
| PUT    | `/api/users/profile` | Update user profile |

### Expenses

| Method | Endpoint            | Description      |
| ------ | ------------------- | ---------------- |
| GET    | `/api/expenses`     | Get all expenses |
| POST   | `/api/expenses`     | Create expense   |
| PUT    | `/api/expenses/:id` | Update expense   |
| DELETE | `/api/expenses/:id` | Delete expense   |

---

## Installation

### Prerequisites

- Node.js (v16+)
- MongoDB
- Expo CLI
- Expo Go app (for mobile testing)

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/Yash020405/Spendwise.git
   cd Spendwise
   ```

2. **Install frontend dependencies**

   ```bash
   npm install
   ```

3. **Install backend dependencies**

   ```bash
   cd server
   npm install
   ```

4. **Configure environment variables**

   Create `.env` in root directory:

   ```env
   EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3000/api
   ```

   Create `.env` in server directory:

   ```env
   MONGODB_URI=mongodb://localhost:27017/spendwise
   JWT_SECRET=your_secret_key
   PORT=3000
   ```

5. **Start MongoDB**

   ```bash
   mongod
   ```

6. **Start the backend server**

   ```bash
   cd server
   npm run dev
   ```

7. **Start the Expo development server**

   ```bash
   npx expo start
   ```

8. **Scan QR code** with Expo Go app to run on your device

---

## Future Roadmap

### v2.0 - Core Enhancements

**Data Management**
- Recurring expenses (auto-add monthly bills)
- Export reports (CSV/PDF)
- Cloud backup and restore

**User Experience**
- Custom categories
- Search and filter expenses
- Biometric app lock

---

### v3.0 - Advanced Features

**Smart Features**
- Receipt scanning with OCR
- AI-powered spending insights

**Collaboration**
- Shared family accounts
- Split expense tracking

**Technical**
- Push notifications
- Home screen widgets
- Comprehensive test coverage

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
