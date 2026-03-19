import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

const firebaseConfig = {
    "projectId": "studio-9222108372-cb224",
    "appId": "1:304292855792:web:af7c84d04a50b025926735",
    "apiKey": "AIzaSyDZMSr9_jKq4HFz01tMQES0NGl2q2BOuR8",
    "authDomain": "studio-9222108372-cb224.firebaseapp.com",
    "measurementId": "",
    "messagingSenderId": "304292855792"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
    console.log("Fetching mov 20260100...");
    const movQuery = query(collection(db, 'movimentacoes'), where('movimentoId', '==', '20260100'));
    const snap = await getDocs(movQuery);
    if (snap.empty) {
        console.log("Movement not found in firestore either. This means it did not save, or it saved with a different ID.");

        // Let's get the latest 5 movements
        console.log("Getting latest 5 movements...");
        const latestDocs = await getDocs(query(collection(db, 'movimentacoes')));
        const allMoves = latestDocs.docs.map(d => d.data());
        console.log("All moves:", allMoves.slice(-5));
        return;
    }
    const data = snap.docs[0].data();
    console.log("Movement data FOR 20260100:", data);
    process.exit(0);
}

check().catch(console.error);
