// script.js

// 1. Signup / Login
async function signUp(email, password, displayName) {
  const userCredential = await auth.createUserWithEmailAndPassword(email, password);
  const user = userCredential.user;

  // Create user doc in Firestore
  await db.collection("users").doc(user.uid).set({
    name: displayName,
    email: email,
    storageUsed: 0,
    freeLimit: 100 * 1024 * 1024 // 100 MB
  });

  console.log("User signed up and Firestore doc created:", user.uid);
}

async function login(email, password) {
  const userCredential = await auth.signInWithEmailAndPassword(email, password);
  console.log("User logged in:", userCredential.user.uid);
  return userCredential.user;
}

// 2. Upload File
async function uploadFile(file) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  // Check storageUsed
  const userDoc = await db.collection("users").doc(user.uid).get();
  const userData = userDoc.data();
  if (userData.storageUsed + file.size > userData.freeLimit) {
    alert("You reached your free storage limit. Upgrade to premium.");
    return;
  }

  // Upload to Firebase Storage
  const storageRef = storage.ref(`user_files/${user.uid}/${file.name}`);
  const snapshot = await storageRef.put(file);
  const downloadURL = await snapshot.ref.getDownloadURL();

  // Store metadata in Firestore
  const fileDoc = await db.collection("files").add({
    ownerId: user.uid,
    fileName: file.name,
    fileType: file.type,
    size: file.size,
    uploadTime: firebase.firestore.Timestamp.now(),
    downloadUrl: downloadURL
  });

  // Update user storageUsed
  await db.collection("users").doc(user.uid).update({
    storageUsed: firebase.firestore.FieldValue.increment(file.size)
  });

  console.log("File uploaded and Firestore doc created:", fileDoc.id);
}

// 3. List Files
async function listFiles() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const filesSnapshot = await db.collection("files")
    .where("ownerId", "==", user.uid)
    .orderBy("uploadTime", "desc")
    .get();

  filesSnapshot.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}

// 4. Delete File
async function deleteFile(fileId) {
  const fileDoc = await db.collection("files").doc(fileId).get();
  const data = fileDoc.data();

  // Delete from Storage
  const storageRef = storage.refFromURL(data.downloadUrl);
  await storageRef.delete();

  // Delete Firestore doc
  await db.collection("files").doc(fileId).delete();

  // Update user storageUsed
  await db.collection("users").doc(data.ownerId).update({
    storageUsed: firebase.firestore.FieldValue.increment(-data.size)
  });

  console.log("File deleted:", fileId);
}
