// =======================
// Auth functions
// =======================
async function signUp(email, password, displayName) {
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection("users").doc(cred.user.uid).set({
      name: displayName,
      email,
      storageUsed: 0,
      freeLimit: 100 * 1024 * 1024,
      role: "user"
    });
    console.log("Signup success");
  } catch (err) {
    console.error("Signup error:", err.message);
  }
}

async function login(email, password) {
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    console.log("Login success:", cred.user.uid);
    monitorFiles();
    monitorUsers();
  } catch (err) {
    console.error("Login error:", err.message);
  }
}

// =======================
// File functions
// =======================
async function uploadFile(file) {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const userDoc = await db.collection("users").doc(user.uid).get();
  const userData = userDoc.data();

  if (userData.storageUsed + file.size > userData.freeLimit) {
    return alert("You reached your free storage limit. Upgrade to premium.");
  }

  const storageRef = storage.ref(`user_files/${user.uid}/${file.name}`);
  const snapshot = await storageRef.put(file);
  const downloadURL = await snapshot.ref.getDownloadURL();

  const fileDoc = await db.collection("files").add({
    ownerId: user.uid,
    fileName: file.name,
    fileType: file.type,
    size: file.size,
    uploadTime: firebase.firestore.Timestamp.now(),
    downloadUrl: downloadURL
  });

  await db.collection("users").doc(user.uid).update({
    storageUsed: firebase.firestore.FieldValue.increment(file.size)
  });

  console.log("File uploaded:", fileDoc.id);
}

async function deleteFile(fileId) {
  const fileDoc = await db.collection("files").doc(fileId).get();
  const data = fileDoc.data();

  // Delete from storage
  const storageRef = storage.refFromURL(data.downloadUrl);
  await storageRef.delete();

  // Delete Firestore doc
  await db.collection("files").doc(fileId).delete();

  // Update user storage
  await db.collection("users").doc(data.ownerId).update({
    storageUsed: firebase.firestore.FieldValue.increment(-data.size)
  });

  console.log("File deleted:", fileId);
}

// =======================
// Real-time file monitoring
// =======================
function monitorFiles() {
  const user = auth.currentUser;
  if (!user) return;

  db.collection("files")
    .where("ownerId", "==", user.uid)
    .orderBy("uploadTime", "desc")
    .onSnapshot(snapshot => {
      const fileList = document.getElementById("fileList");
      fileList.innerHTML = "";

      snapshot.forEach(doc => {
        const data = doc.data();
        const li = document.createElement("li");
        li.textContent = `${data.fileName} (${(data.size/1024).toFixed(1)} KB)`;

        const a = document.createElement("a");
        a.href = data.downloadUrl;
        a.textContent = " [Download]";
        a.target = "_blank";
        li.appendChild(a);

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.onclick = () => deleteFile(doc.id);
        li.appendChild(delBtn);

        fileList.appendChild(li);
      });
    });
}

// =======================
// Admin monitoring
// =======================
function monitorUsers() {
  const user = auth.currentUser;
  if (!user) return;

  db.collection("users").doc(user.uid).get().then(doc => {
    if (doc.data().role !== "admin") return; // only admins

    db.collection("users").onSnapshot(snapshot => {
      const userList = document.getElementById("userList");
      if (!userList) return;
      userList.innerHTML = "";

      snapshot.forEach(userDoc => {
        const data = userDoc.data();
        const li = document.createElement("li");
        li.textContent = `User: ${data.name}, Email: ${data.email}, Used: ${(data.storageUsed/1024/1024).toFixed(1)} MB`;

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete User";
        delBtn.onclick = () => deleteUser(userDoc.id);
        li.appendChild(delBtn);

        userList.appendChild(li);
      });
    });
  });
}

// =======================
// Admin add/delete users
// =======================
async function addUser(email, password, displayName) {
  const userCredential = await auth.createUserWithEmailAndPassword(email, password);
  const user = userCredential.user;

  await db.collection("users").doc(user.uid).set({
    name: displayName,
    email: email,
    storageUsed: 0,
    freeLimit: 100 * 1024 * 1024,
    role: "user"
  });

  console.log("Admin created new user:", user.uid);
}

async function deleteUser(userId) {
  if (!confirm("Delete this user and all their files?")) return;

  const filesSnapshot = await db.collection("files").where("ownerId", "==", userId).get();
  for (let doc of filesSnapshot.docs) {
    const fileData = doc.data();
    await storage.refFromURL(fileData.downloadUrl).delete();
    await db.collection("files").doc(doc.id).delete();
  }

  await db.collection("users").doc(userId).delete();
  console.log(`User ${userId} deleted (Firestore + files). Auth deletion requires Admin SDK.`);
}

 document.getElementById("signupBtn").addEventListener("click", () => {
  const name = document.getElementById("signupName").value;
  const email = document.getElementById("signupEmail").value;
  const pass = document.getElementById("signupPass").value;
  signUp(email, pass, name);
});

document.getElementById("loginBtn").addEventListener("click", () => {
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPass").value;
  login(email, pass);
});
