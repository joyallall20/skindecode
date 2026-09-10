import User from '../models/User.js';

export const syncUserFromFirebase = async (firebaseUser) => {
  const { uid, email, name } = firebaseUser;

  return User.findOneAndUpdate(
    { firebaseUid: uid },

    {
      $set: {
        email: email || `${uid}@firebase.local`,
        name: name || '',
        lastLoginAt: new Date(),
      },

      $setOnInsert: {
        firebaseUid: uid,
        role: 'user',
      },
    },

    {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
};

export default syncUserFromFirebase;