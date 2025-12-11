import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { 
    getAuth, signOut, onAuthStateChanged, updateProfile, 
    GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber 
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js"; 
import { 
    getFirestore, collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, 
    onSnapshot, query, where, orderBy, limit 
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { 
    getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

// 🔹 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyB5jaPVkCwxXiMYhSn0uuW9QSMc-B5C9YY",
  authDomain: "mjsmartapps.firebaseapp.com",
  projectId: "mjsmartapps",
  storageBucket: "mjsmartapps.firebasestorage.app",
  messagingSenderId: "1033240518010",
  appId: "1:1033240518010:web:930921011dda1bd56e0ac3",
  measurementId: "G-959VLQSHH2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Replaced Realtime Database with Firestore
const storage = getStorage(app); // Initialize Storage

// Use 'en' language for Auth flow
auth.languageCode = 'en';

let currentUserId = null; 
let currentUserEmail = null; 
let currentUserPhone = null; 
let currentUserAddress = null; 
let currentUserName = null;
let cartCount = 0; 
let pendingAction = null; 
let itemToDelete = null; 

// 🚘 VEHICLE DATA FOR DROPDOWNS
const vehicleDatabase = {
    car: {
        "Maruti Suzuki": ["Swift", "Baleno", "Brezza", "Dzire", "Ertiga", "Alto", "WagonR", "Celerio", "S-Presso", "Ciaz", "XL6", "Grand Vitara"],
        "Hyundai": ["Creta", "Venue", "i20", "Grand i10 Nios", "Verna", "Aura", "Alcazar", "Tucson"],
        "Tata": ["Nexon", "Punch", "Harrier", "Safari", "Tiago", "Tigor", "Altroz"],
        "Mahindra": ["Thar", "XUV700", "Scorpio-N", "XUV300", "Bolero", "Marazzo"],
        "Toyota": ["Innova Crysta", "Fortuner", "Glanza", "Urban Cruiser Hyryder", "Hilux"],
        "Honda": ["City", "Amaze", "Elevate"],
        "Kia": ["Seltos", "Sonet", "Carens", "Carnival"],
        "Volkswagen": ["Virtus", "Taigun", "Tiguan"],
        "Skoda": ["Slavia", "Kushaq", "Kodiaq"],
        "MG": ["Hector", "Astor", "Gloster", "Comet EV", "ZS EV"],
        "Renault": ["Kwid", "Triber", "Kiger"]
    },
    bike: {
        "Hero": ["Splendor Plus", "HF Deluxe", "Passion Pro", "Glamour", "Xpulse 200", "Xtreme 160R"],
        "Honda": ["Activa 6G", "Shine", "SP 125", "Unicorn", "Dio", "Hornet 2.0", "CB350"],
        "TVS": ["Jupiter", "Apache RTR 160", "Apache RTR 200", "Raider", "Sport", "XL100"],
        "Bajaj": ["Pulsar 150", "Pulsar NS200", "Platina", "CT 100", "Dominar 400", "Avenger"],
        "Royal Enfield": ["Classic 350", "Bullet 350", "Hunter 350", "Meteor 350", "Himalayan"],
        "Yamaha": ["MT-15", "R15 V4", "FZ-S", "Fascino", "RayZR"],
        "Suzuki": ["Access 125", "Burgman Street", "Gixxer"],
        "KTM": ["Duke 200", "Duke 390", "RC 200", "RC 390"]
    }
};

const loader = document.getElementById('loader-bar');
window.showLoader = () => { loader.style.display = 'block'; };
window.hideLoader = () => { loader.style.display = 'none'; };

// 🔹 Toast Notification
window.showToast = (message, type = 'success') => {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-triangle-exclamation'}"></i> ${message}`;
  toastContainer.prepend(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000); 
};

// ... [Authentication Logic] ...
window.openLoginModal = (action, data = null) => {
    pendingAction = { action, data }; 
    const modal = document.getElementById('loginModal');
    const overlay = document.getElementById('loginOverlay');
    window.resetLoginForms();
    overlay.style.display = 'flex';
    setTimeout(() => modal.classList.add('open'), 10);
    document.body.style.overflow = 'hidden'; 

    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'normal',
            'callback': (response) => {},
            'expired-callback': () => { showToast("Recaptcha expired. Refresh.", "warning"); }
        });
        window.recaptchaVerifier.render();
    }
};

window.closeLoginModal = () => {
    const modal = document.getElementById('loginModal');
    modal.classList.remove('open');
    setTimeout(() => {
         document.getElementById('loginOverlay').style.display = 'none';
         document.body.style.overflow = 'auto';
    }, 300);
}

window.resetLoginForms = () => {
    document.getElementById('login-step-phone').style.display = 'block';
    document.getElementById('login-step-otp').style.display = 'none';
    document.getElementById('loginOtpInput').value = '';
}

window.startGoogleLogin = async () => {
    showLoader();
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        closeLoginModal();
    } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user') {
            showToast(`Login failed: ${error.message}`, "error");
        }
    } finally { hideLoader(); }
};

window.sendOTP = () => {
    const phoneVal = document.getElementById('loginPhoneInput').value.trim();
    if (!/^\d{10}$/.test(phoneVal)) {
        showToast("Enter valid 10-digit mobile number", "warning");
        return;
    }
    const appVerifier = window.recaptchaVerifier;
    const phoneNumber = "+91" + phoneVal;

    showLoader();
    signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((confirmationResult) => {
            window.confirmationResult = confirmationResult;
            hideLoader();
            showToast("OTP Sent!", "success");
            document.getElementById('login-step-phone').style.display = 'none';
            document.getElementById('login-step-otp').style.display = 'block';
            document.getElementById('otp-sent-to').innerText = phoneNumber;
        }).catch((error) => {
            hideLoader();
            console.error(error);
            showToast(error.message, "error");
            window.recaptchaVerifier.render().then(function(widgetId) {
                grecaptcha.reset(widgetId);
            });
        });
};

window.verifyOTP = () => {
    const code = document.getElementById('loginOtpInput').value.trim();
    if(code.length < 6) return showToast("Enter full 6-digit OTP", "warning");

    showLoader();
    window.confirmationResult.confirm(code).then((result) => {
        const user = result.user;
        showToast("Verified & Logged In!", "success");
        closeLoginModal();
        hideLoader();
    }).catch((error) => {
        hideLoader();
        showToast("Invalid OTP. Try again.", "error");
    });
};

// ... [Cart Logic] ...
function getLocalCart() {
    const stored = localStorage.getItem('motoHubCart');
    return stored ? JSON.parse(stored) : [];
}

function saveLocalCart(cart) {
    localStorage.setItem('motoHubCart', JSON.stringify(cart));
    loadCartCount(); 
}

window.loadCartCount = () => {
    const cart = getLocalCart();
    cartCount = cart.length;
    const countEls = ['cart-count', 'cart-count-drawer', 'cart-count-display'];
    countEls.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = cartCount;
    });
}

window.addToCart = (vehicleKey, vehicleName) => {
    let cart = getLocalCart();
    if (!cart.includes(vehicleKey)) {
        cart.push(vehicleKey);
        saveLocalCart(cart);
        showToast(`${vehicleName} added to cart!`, "success");
    } else {
        showToast(`${vehicleName} is already in your cart.`, "warning");
    }
};

window.askRemoveFromCart = (vehicleKey, vehicleName) => {
    itemToDelete = { key: vehicleKey, name: vehicleName };
    document.getElementById('deleteItemName').innerText = vehicleName;
    
    const modal = document.getElementById('deleteConfirmModal');
    const overlay = document.getElementById('deleteConfirmOverlay');
    overlay.style.display = 'flex';
    setTimeout(() => modal.classList.add('open'), 10);
};

window.closeDeleteConfirmModal = () => {
    const modal = document.getElementById('deleteConfirmModal');
    modal.classList.remove('open');
    setTimeout(() => {
         document.getElementById('deleteConfirmOverlay').style.display = 'none';
         itemToDelete = null;
    }, 300);
};

window.confirmRemoveFromCart = () => {
    if (!itemToDelete) return;
    
    let cart = getLocalCart();
    const newCart = cart.filter(id => id !== itemToDelete.key);
    saveLocalCart(newCart);
    
    showToast(`${itemToDelete.name} removed from cart.`, "success");
    closeDeleteConfirmModal();
    loadCartItems(); 
};

window.loadCartItems = async () => {
    const cartList = document.getElementById("cartItemsList");
    const cartSummary = document.getElementById("cartSummary");
    const checkoutBtn = document.getElementById('checkoutButton');
    
    cartList.innerHTML = '<p style="padding:10px; text-align:center; color:var(--text-muted)">Loading cart...</p>'; 

    const cartKeys = getLocalCart();
    
    if (cartKeys.length === 0) {
        document.getElementById('cart-count-display').innerText = 0;
        cartList.innerHTML = '<p class="empty-state" style="text-align:center; padding:20px;">Your cart is empty.</p>';
        cartSummary.innerHTML = '<p>Total: <span>₹0</span></p>';
        checkoutBtn.disabled = true;
        return;
    }

    checkoutBtn.disabled = false;
    
    // Fetch individual docs from Firestore using keys
    const fetchPromises = cartKeys.map(key => {
        return getDoc(doc(db, "vehicles", key)).then(docSnap => {
            if (docSnap.exists()) {
                return { key: docSnap.id, ...docSnap.data() };
            }
            return null;
        });
    });

    const vehicles = (await Promise.all(fetchPromises)).filter(v => v !== null);

    cartList.innerHTML = ''; 
    let totalCartPrice = 0;

    vehicles.forEach(v => {
        const displayPrice = v.adminPrice || v.price || 0;
        totalCartPrice += parseInt(displayPrice);

        const cartItem = document.createElement("div");
        cartItem.className = "cart-item-card";
        cartItem.innerHTML = `
            <div class="item-image" style="background-image: url('${v.img}');"></div>
            <div class="item-info">
                <h3>${v.name}</h3>
                <p class="text-muted" style="margin:0; font-size:12px;">${v.year} | ${v.km} km</p>
            </div>
            <div style="text-align:right;">
                <p class="price">₹${parseInt(displayPrice).toLocaleString('en-IN')}</p>
                <button class="btn btn-outline" style="padding:5px 10px; font-size:12px;" onclick="askRemoveFromCart('${v.key}', '${v.name}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        cartList.appendChild(cartItem);
    });

    cartSummary.innerHTML = `
        <div style="border-bottom:1px solid var(--border-color); padding-bottom:15px; margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between;"><span>Subtotal</span> <span>₹${totalCartPrice.toLocaleString('en-IN')}</span></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:20px; font-weight:700; color:var(--primary);">
            <span>Total</span> <span>₹${totalCartPrice.toLocaleString('en-IN')}</span>
        </div>
        <div style="margin-top:20px">
            <button class="btn btn-primary full-width-btn" onclick="checkoutCart()">Proceed to Checkout</button>
        </div>
    `;
};

// 🔹 HELPER: Check Profile Completion
window.checkProfileRequirement = () => {
    // Requirements: Name, Address, and Phone must be present.
    // Note: Email is optional for phone users, but phone is mandatory for everyone.
    if (!currentUserId) return false;
    
    // Check global variables loaded from profile
    if (!currentUserName || currentUserName.trim() === "") return false;
    if (!currentUserPhone || currentUserPhone.trim() === "") return false;
    if (!currentUserAddress || currentUserAddress.trim() === "") return false;
    
    return true;
};

// 🛒 CHECKOUT CART
window.checkoutCart = async () => {
    if (!currentUserId) {
        showToast("Please log in to checkout.", "warning");
        return window.openLoginModal('checkout');
    }
    
    // 🔹 Profile Check Constraint
    if (!window.checkProfileRequirement()) {
        showToast("Please complete your profile (Name, Phone, Address) to proceed.", "warning");
        showSection('profile');
        return;
    }

    const cartKeys = getLocalCart();
    if (cartKeys.length === 0) return;

    showLoader();
    try {
        const fetchPromises = cartKeys.map(key => getDoc(doc(db, "vehicles", key)));
        const snapshots = await Promise.all(fetchPromises);
        
        let total = 0;
        let count = 0;
        
        snapshots.forEach(snap => {
            if (snap.exists()) {
                const v = snap.data();
                const displayPrice = v.adminPrice || v.price || 0;
                total += parseInt(displayPrice);
                count++;
            }
        });

        if (count === 0) {
            showToast("Cart items are no longer available.", "warning");
            hideLoader();
            return;
        }

        window.openCartCheckoutModal(count, total);

    } catch (err) {
        console.error(err);
        showToast("Error processing cart.", "error");
    } finally {
        hideLoader();
    }
}

window.openCartCheckoutModal = (count, total) => {
    const modal = document.getElementById('cartCheckoutModal');
    const overlay = document.getElementById('cartCheckoutOverlay');
    
    document.getElementById('cartConfirmCount').innerText = count;
    document.getElementById('cartConfirmTotal').innerText = `₹${total.toLocaleString('en-IN')}`;
    modal.dataset.totalPrice = total; 
    
    document.getElementById('cartPaymentOption').value = 'emi';
    document.getElementById('cartDownPayment').value = Math.min(total * 0.20, 100000).toFixed(0);
    document.getElementById('cartLoanAmountDisplay').innerText = `₹${total.toLocaleString('en-IN')}`;
    
    window.updateCartEMICalculation(); 
    
    overlay.style.display = 'flex';
    setTimeout(() => modal.classList.add('open'), 10);
    document.body.style.overflow = 'hidden';
}

window.closeCartCheckoutModal = () => {
    const modal = document.getElementById('cartCheckoutModal');
    modal.classList.remove('open');
    setTimeout(() => {
         document.getElementById('cartCheckoutOverlay').style.display = 'none';
         document.body.style.overflow = 'auto';
    }, 300);
}

window.updateCartEMICalculation = () => {
    const modal = document.getElementById('cartCheckoutModal');
    const price = parseInt(modal.dataset.totalPrice) || 0;
    const paymentOption = document.getElementById('cartPaymentOption').value;
    const emiSection = document.getElementById('cartEmiArrangementSection');
    const confirmBtn = document.getElementById('cartConfirmBtn');

    let loanInfo = { downPayment: 0, loanTenure: 0, interestRate: 0, loanAmount: 0, emi: 0 };

    if (paymentOption === 'full_paid') {
        emiSection.style.display = 'none';
        confirmBtn.innerText = 'Confirm Full Payment Order';
    } else {
        emiSection.style.display = 'block';
        const downPaymentInput = document.getElementById('cartDownPayment');
        let downPayment = parseInt(downPaymentInput.value) || 0;
        
        if(downPayment > price) { downPayment = price; downPaymentInput.value = downPayment; }
        
        const loanTenure = parseInt(document.getElementById('cartLoanTenure').value) || 12;
        const interestRate = parseFloat(document.getElementById('cartInterestRate').value) || 10;
        const loanAmount = Math.max(0, price - downPayment);
        const emi = calculateEMI(loanAmount, interestRate, loanTenure / 12);

        document.getElementById('cartLoanAmountDisplay').innerText = `₹${loanAmount.toLocaleString('en-IN')}`;
        document.getElementById('cartMonthlyEMI').innerText = emi > 0 ? `₹${Math.round(emi).toLocaleString('en-IN')}` : '₹0';
        confirmBtn.innerText = 'Arrange Loan & Place Order';
        
        loanInfo = { downPayment, loanTenure, interestRate, loanAmount, emi };
    }
    return loanInfo;
}

window.confirmCartOrder = async () => {
    const cartKeys = getLocalCart();
    if (cartKeys.length === 0) return;

    showLoader();

    try {
        const fetchPromises = cartKeys.map(key => getDoc(doc(db, "vehicles", key)));
        const snapshots = await Promise.all(fetchPromises);

        const orderPromises = [];
        const paymentMethod = document.getElementById('cartPaymentOption').value;
        
        let loanDetails = { 
            downPayment: 0, loanTenure: 0, interestRate: 0, loanAmount: 0 
        };

        if (paymentMethod === 'emi') {
             const calc = window.updateCartEMICalculation();
             loanDetails = {
                 downPayment: calc.downPayment, 
                 loanTenure: calc.loanTenure,
                 interestRate: calc.interestRate,
                 loanAmount: calc.loanAmount
             };
        }

        snapshots.forEach(snap => {
            if (snap.exists()) {
                const v = snap.data();
                const displayPrice = v.adminPrice || v.price || 0;

                const orderData = {
                    vehicleKey: snap.id,
                    vehicleName: v.name,
                    price: displayPrice,
                    timestamp: new Date().toISOString(),
                    status: "processing",
                    paymentMethod: paymentMethod === 'emi' ? 'cart_emi' : 'cart_full_paid',
                    loanInfo: {
                        loanTenure: loanDetails.loanTenure,
                        interestRate: loanDetails.interestRate,
                        totalCartDownPayment: loanDetails.downPayment 
                    },
                    buyerInfo: { 
                        name: currentUserName || "Valued Customer", 
                        email: currentUserEmail || "Phone User",
                        phone: currentUserPhone, 
                        address: currentUserAddress || 'Not Provided'
                    }
                };

                orderPromises.push(addDoc(collection(db, "users", currentUserId, "orders"), orderData));
            }
        });

        if (orderPromises.length > 0) {
            await Promise.all(orderPromises);
            
            localStorage.removeItem('motoHubCart');
            loadCartCount();
            loadCartItems();
            
            window.closeCartCheckoutModal();
            showToast("Orders placed successfully!", "success");
            showSection('order'); 
        } else {
            showToast("Items in cart are no longer available.", "warning");
            localStorage.removeItem('motoHubCart');
            loadCartCount();
            loadCartItems();
            window.closeCartCheckoutModal();
        }

    } catch (err) {
        console.error("Checkout Error:", err);
        showToast("Failed to place order: " + err.message, "error");
        window.closeCartCheckoutModal();
    } finally {
        hideLoader();
    }
}

// ... [Buy Vehicle Logic] ...
window.buyVehicle = async (vehicleKey, vehicleName, price) => {
    const vehicleData = { key: vehicleKey, name: vehicleName, price: price };
    if (!currentUserId) {
        showToast("Log in to purchase.", "warning");
        return window.openLoginModal('buy', vehicleData);
    }
    
    // 🔹 Profile Check Constraint
    if (!window.checkProfileRequirement()) {
        showToast("Please complete your profile (Name, Phone, Address) to proceed.", "warning");
        showSection('profile');
        return;
    }

    window.closeDetailsModal(); 
    window.openBuyNowModal(vehicleData);
};

window.placeOrderFromModal = async (vehicleKey, vehicleName, price, paymentMethod, downPayment, loanTenure, interestRate, loanAmount) => {
    // Double check profile requirement just in case
    if (!currentUserPhone || currentUserPhone.length < 10 || !currentUserName || !currentUserAddress) {
        showToast("Profile details missing.", "error");
        showSection('profile'); closeBuyNowModal(); return;
    }
    showLoader();
    try {
        const orderData = {
            vehicleKey, vehicleName, price,
            timestamp: new Date().toISOString(), status: "processing", paymentMethod, 
            loanInfo: {
                downPayment: paymentMethod === 'emi' ? (parseInt(downPayment) || 0) : 0, 
                loanTenure: paymentMethod === 'emi' ? (parseInt(loanTenure) || 0) : 0,
                interestRate: paymentMethod === 'emi' ? (parseFloat(interestRate) || 0) : 0,
                loanAmount: paymentMethod === 'emi' ? (parseInt(loanAmount) || 0) : 0 
            },
            buyerInfo: { 
                name: currentUserName || "Valued Customer", 
                email: currentUserEmail || "Phone User",
                phone: currentUserPhone, 
                address: currentUserAddress || 'Not Provided'
            }
        };

        await addDoc(collection(db, "users", currentUserId, "orders"), orderData);

        showToast(`Order placed for ${vehicleName}!`, "success");
        closeBuyNowModal(); showSection('order'); 
    } catch (err) { showToast(err.message, "error"); } finally { hideLoader(); }
}

window.calculateEMI = (principal, rate, years) => {
    if (principal <= 0 || rate <= 0 || years <= 0) return 0;
    const monthlyRate = (rate / 100) / 12; 
    const numberOfPayments = years * 12;
    return principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
}

window.openBuyNowModal = (vehicleData) => {
    const modal = document.getElementById('buyNowModal');
    const overlay = document.getElementById('buyNowOverlay');
    const price = parseInt(vehicleData.price);
    
    document.getElementById('modalVehicleName').innerText = vehicleData.name;
    document.getElementById('modalVehiclePrice').innerText = `₹${price.toLocaleString('en-IN')}`;
    
    const paymentOptionSelect = document.getElementById('modalPaymentOption');
    if (paymentOptionSelect) paymentOptionSelect.value = 'emi';

    document.getElementById('modalDownPayment').value = Math.min(price * 0.20, 50000).toFixed(0); 
    document.getElementById('modalLoanAmountDisplay').innerText = `₹${price.toLocaleString('en-IN')}`;

    modal.dataset.vehicleKey = vehicleData.key;
    modal.dataset.vehicleName = vehicleData.name;
    modal.dataset.vehiclePrice = vehicleData.price;

    window.updateEMICalculation(); 
    overlay.style.display = 'flex'; 
    setTimeout(() => modal.classList.add('open'), 10);
    document.body.style.overflow = 'hidden'; 
}

window.closeBuyNowModal = () => {
    const modal = document.getElementById('buyNowModal');
    modal.classList.remove('open');
    setTimeout(() => {
         document.getElementById('buyNowOverlay').style.display = 'none';
         document.body.style.overflow = 'auto';
    }, 300);
}

window.updateEMICalculation = () => {
    const modal = document.getElementById('buyNowModal');
    if (!modal || !modal.dataset.vehiclePrice) return { loanAmount: 0, emi: 0 }; 
    const price = parseInt(modal.dataset.vehiclePrice);
    const paymentOption = document.getElementById('modalPaymentOption').value;
    const emiSection = document.getElementById('emiArrangementSection');
    
    let effectiveDownPayment = 0, loanAmount = 0, emi = 0, loanTenure = 0, interestRate = 0;

    if (paymentOption === 'full_paid') {
        emiSection.style.display = 'none';
        document.getElementById('modalLoanAmountDisplay').innerText = `₹0`;
        document.getElementById('modalMonthlyEMI').innerText = 'N/A';
        document.getElementById('modalConfirmOrder').innerText = 'Confirm Full Payment';
        return { loanAmount: 0, emi: 0 };
    } else {
        emiSection.style.display = 'block';
        const downPayment = parseInt(document.getElementById('modalDownPayment').value) || 0;
        effectiveDownPayment = Math.min(downPayment, price);
        document.getElementById('modalDownPayment').value = effectiveDownPayment.toFixed(0); 

        loanTenure = parseInt(document.getElementById('modalLoanTenure').value) || 12;
        interestRate = parseFloat(document.getElementById('modalInterestRate').value) || 10;
        loanAmount = Math.max(0, price - effectiveDownPayment);
        emi = calculateEMI(loanAmount, interestRate, loanTenure / 12); 
        
        document.getElementById('modalLoanAmountDisplay').innerText = `₹${loanAmount.toLocaleString('en-IN')}`;
        document.getElementById('modalMonthlyEMI').innerText = emi > 0 ? `₹${Math.round(emi).toLocaleString('en-IN')}` : '₹0';
        document.getElementById('modalConfirmOrder').innerText = loanAmount > 0 ? 'Arrange Loan & Order' : 'Confirm Cash Order';
        
        return { loanAmount, emi, downPayment: effectiveDownPayment, loanTenure, interestRate };
    }
}

window.confirmBuyNow = () => {
    const modal = document.getElementById('buyNowModal');
    const key = modal.dataset.vehicleKey;
    const name = modal.dataset.vehicleName;
    const price = modal.dataset.vehiclePrice;
    const paymentMethod = document.getElementById('modalPaymentOption').value;

    if (paymentMethod === 'full_paid') {
        window.placeOrderFromModal(key, name, price, paymentMethod, 0, 0, 0, 0);
        return;
    }
    const { loanAmount } = window.updateEMICalculation(); 
    const downPayment = document.getElementById('modalDownPayment').value;
    const loanTenure = document.getElementById('modalLoanTenure').value;
    const interestRate = document.getElementById('modalInterestRate').value;
    window.placeOrderFromModal(key, name, price, paymentMethod, downPayment, loanTenure, interestRate, loanAmount);
}

// ... [Keep Details Modal, History, Profile Logic unchanged] ...
window.openDetailsModal = (vehicleKey) => {
    const modal = document.getElementById('detailsModal');
    const overlay = document.getElementById('detailsOverlay');
    showLoader();

    // Firestore fetch
    getDoc(doc(db, "vehicles", vehicleKey)).then((snapshot) => {
        if (!snapshot.exists()) { hideLoader(); return; }
        const v = snapshot.data();

        const displayPrice = v.adminPrice || v.price || 0;
        
        document.getElementById('detailTitle').innerText = v.name;
        document.getElementById('detailPrice').innerText = `₹${parseInt(displayPrice).toLocaleString('en-IN')}`;
        document.getElementById('detailDesc').innerText = v.description || 'No description available.';
        document.getElementById('detailYear').innerText = v.year;
        document.getElementById('detailKm').innerText = v.km + ' km';
        document.getElementById('detailType').innerText = v.type.toUpperCase();
        
        const s = v.specs || {};
        const specsHtml = `
            <tr><td>Fuel</td><td>${s.fuel || '-'}</td></tr>
            <tr><td>Transmission</td><td>${s.transmission || '-'}</td></tr>
            <tr><td>Body Type</td><td>${s.bodyType || '-'}</td></tr>
            <tr><td>Mileage</td><td>${s.mileage || '-'}</td></tr>
            <tr><td>Engine CC</td><td>${s.engine || '-'}</td></tr>
            <tr><td>Max Torque</td><td>${s.torque || '-'}</td></tr>
            ${s.airbags ? `<tr><td>Airbags</td><td>${s.airbags}</td></tr>` : ''}
            ${s.bootSpace ? `<tr><td>Boot Space</td><td>${s.bootSpace} L</td></tr>` : ''}
            <tr><td>Ground Clearance</td><td>${s.groundClearance || '-'} mm</td></tr>
            <tr><td>Fuel Tank</td><td>${s.fuelTank || '-'} L</td></tr>
            ${s.seating ? `<tr><td>Seating</td><td>${s.seating}</td></tr>` : ''}
            <tr><td>Drive Type</td><td>${s.driveType || '-'}</td></tr>
        `;
        document.getElementById('techSpecsBody').innerHTML = specsHtml;

        const mainImg = document.getElementById('detailMainImg');
        const thumbContainer = document.getElementById('detailThumbnails');
        let images = [];
        
        if (v.vimages) {
            images = v.vimages.split(',').filter(url => url.trim() !== '');
        } else if (v.img) {
            images = [v.img];
        }
        if (images.length === 0) images = ["https://via.placeholder.com/600x400?text=No+Image"];

        mainImg.src = images[0];
        thumbContainer.innerHTML = '';
        images.forEach((src, index) => {
            const thumb = document.createElement('img');
            thumb.src = src;
            thumb.className = `thumb-img ${index === 0 ? 'active' : ''}`;
            thumb.onclick = () => {
               mainImg.src = src;
               document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
               thumb.classList.add('active');
            };
            thumbContainer.appendChild(thumb);
        });

        const actionsDiv = document.getElementById('detailActions');
        actionsDiv.innerHTML = `
             <button class="btn btn-outline" style="flex:1" onclick="addToCart('${snapshot.id}', '${v.name}')"><i class="fa-solid fa-cart-plus"></i> Add to Cart</button>
             <button class="btn btn-primary" style="flex:1" onclick="buyVehicle('${snapshot.id}', '${v.name}', '${displayPrice}')">Buy Now</button>
        `;

        hideLoader();
        overlay.style.display = 'flex';
        setTimeout(() => modal.classList.add('open'), 10);
        document.body.style.overflow = 'hidden';
    }).catch(err => { hideLoader(); console.error(err); });
};

window.closeDetailsModal = () => {
    const modal = document.getElementById('detailsModal');
    modal.classList.remove('open');
    setTimeout(() => {
         document.getElementById('detailsOverlay').style.display = 'none';
         document.body.style.overflow = 'auto';
    }, 300);
};

window.loadOrdersHistory = () => {
    const ordersTableBody = document.getElementById("ordersTableBody");
    ordersTableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    if (!currentUserId) { ordersTableBody.innerHTML = '<tr><td colspan="5">Log in to view history.</td></tr>'; return; }
    
    const q = query(collection(db, "users", currentUserId, "orders"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        ordersTableBody.innerHTML = "";
        let recordsFound = 0;
        
        snapshot.forEach((doc) => {
            recordsFound++;
            const order = doc.data();
            const orderId = doc.id;
            const statusClass = order.status === 'processing' ? 'pending' : (order.status === 'cancelled' ? 'rejected' : 'approved');
            
            // Updated with data-label for Grid Layout View
            const row = `
                <tr>
                    <td data-label="Order ID">#${orderId.substring(0, 8).toUpperCase()}</td>
                    <td data-label="Vehicle">${order.vehicleName}</td>
                    <td data-label="Price/Type"><span style="color:var(--primary); font-weight:600;">₹${parseInt(order.price).toLocaleString('en-IN')}</span><br><small>${order.paymentMethod === 'full_paid' || order.paymentMethod === 'cart_full_paid' ? 'Full Paid' : 'EMI / Loan'}</small></td>
                    <td data-label="Date">${new Date(order.timestamp).toLocaleDateString('en-IN')}</td>
                    <td data-label="Status"><span class="status-badge ${statusClass}">${order.status}</span></td>
                </tr>
            `;
            ordersTableBody.insertAdjacentHTML("beforeend", row);
        });
        if (recordsFound === 0) ordersTableBody.innerHTML = '<tr><td colspan="5">No orders found.</td></tr>';
    });
};

async function loadUserProfile(user) {
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        const profileData = docSnap.exists() ? docSnap.data() : {};
        
        // 🔹 Determine Primary Key / Auth Method
        // Check if user authenticated via Phone
        const isPhoneAuth = user.providerData.some(p => p.providerId === 'phone') || (!user.email && user.phoneNumber);
        // Check if user authenticated via Google/Email
        const isGoogleAuth = user.providerData.some(p => p.providerId === 'google.com') || (user.email && !user.phoneNumber);

        const emailInput = document.getElementById("profile-input-email");
        const phoneInput = document.getElementById("profile-input-phone");

        // Reset classes
        emailInput.classList.remove('input-readonly');
        emailInput.disabled = false;
        phoneInput.classList.remove('input-readonly');
        phoneInput.disabled = false;

        // Apply Locking Logic
        if (isPhoneAuth) {
            // Logged in via Phone -> Lock Phone Field
            currentUserPhone = user.phoneNumber;
            phoneInput.value = user.phoneNumber;
            phoneInput.disabled = true;
            phoneInput.classList.add('input-readonly');
            
            currentUserEmail = profileData.email || ""; // Editable email
            emailInput.value = currentUserEmail;
        } else if (isGoogleAuth) {
            // Logged in via Google -> Lock Email Field
            currentUserEmail = user.email;
            emailInput.value = user.email;
            emailInput.disabled = true;
            emailInput.classList.add('input-readonly');

            currentUserPhone = profileData.phone || ""; // Editable phone
            phoneInput.value = currentUserPhone;
        } else {
            // Fallback
            currentUserEmail = user.email || profileData.email || "";
            currentUserPhone = user.phoneNumber || profileData.phone || "";
            emailInput.value = currentUserEmail;
            phoneInput.value = currentUserPhone;
        }
        
        currentUserAddress = profileData.address || null;
        currentUserName = profileData.name || user.displayName || "";

        document.getElementById("profile-input-name").value = currentUserName;
        document.getElementById("profile-input-address").value = currentUserAddress || "";

        document.getElementById("userNameProfile").innerText = currentUserName || "User";
        document.getElementById("userEmailProfile").innerText = currentUserEmail || currentUserPhone;
        document.getElementById("userPhoneProfile").innerText = currentUserPhone || "N/A";
        document.getElementById("userAddressProfile").innerText = currentUserAddress || "N/A";
    } catch (error) { console.error(error); }
}

window.updateUserProfile = async () => {
    if (!currentUserId) return showToast("Log in required.", "warning");
    const newName = document.getElementById("profile-input-name").value.trim();
    const newPhone = document.getElementById("profile-input-phone").value.trim();
    const newEmail = document.getElementById("profile-input-email").value.trim();
    const newAddress = document.getElementById("profile-input-address").value.trim();

    if (!newName || !newPhone || newPhone.length < 10) return showToast("Invalid Name or Phone.", "warning");
    if (!newAddress) return showToast("Address is required.", "warning");

    showLoader();
    try {
        if(auth.currentUser) await updateProfile(auth.currentUser, { displayName: newName });
        
        // Save to Firestore
        await setDoc(doc(db, "users", currentUserId), { 
            name: newName, 
            phone: newPhone, 
            email: newEmail,
            address: newAddress 
        }, { merge: true });

        // Refresh local state
        await loadUserProfile(auth.currentUser); 
        
        // Update seller form if open
        document.getElementById("selleremail").value = currentUserEmail || "";
        document.getElementById("sellername").value = newName;
        document.getElementById("sellerphone").value = newPhone;
        
        showToast("Profile updated!", "success");
    } catch (error) { showToast(error.message, "error"); } finally { hideLoader(); }
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUserId = null; currentUserEmail = null; currentUserName = null;
    document.getElementById("userNameDrawer").innerText = "Guest";
    document.getElementById("userEmailDrawer").innerText = "Please log in";
    // Using static icon now, no image src change needed
  } else {
    currentUserId = user.uid; 
    
    await loadUserProfile(user); 
    
    document.getElementById("userNameDrawer").innerText = currentUserName || "User";
    document.getElementById("userEmailDrawer").innerText = user.email || user.phoneNumber;
    
    document.getElementById("selleremail").value = currentUserEmail || "";
    document.getElementById("sellername").value = currentUserName || "";
    document.getElementById("sellerphone").value = currentUserPhone || "";
  }
  loadCartCount(); 
  if (user && pendingAction) {
      showToast(`Welcome back! Resuming...`, "success");
      const { action, data } = pendingAction; pendingAction = null; 
      if (action === 'buy') window.buyVehicle(data.key, data.name, data.price); 
      else if (action === 'checkout') window.checkoutCart(); 
  }
});

window.logout = () => {
  signOut(auth).then(() => { showToast("Logged out.", "success"); window.showSection('home'); });
};

// ... [Image Handling, Dropdowns, Add Vehicle etc... UNCHANGED] ...
// 📸 UPDATED IMAGE HANDLING (MAX 5, MAX 2MB, STORAGE UPLOAD PREP)
const selectedImages = []; let imageIdCounter = 0;
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes

window.handleFileSelection = (event) => {
  const newFiles = Array.from(event.target.files || []);
  
  if (selectedImages.length + newFiles.length > MAX_IMAGES) {
      showToast(`Limit reached. Maximum ${MAX_IMAGES} images allowed.`, "warning");
      event.target.value = ""; // clear input
      return;
  }

  newFiles.forEach(file => {
    if (file.size > MAX_FILE_SIZE) {
        showToast(`Skipped ${file.name}: Exceeds 2MB limit.`, "warning");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      // Store object with file for uploading later, src for preview
      selectedImages.push({ 
          id: `img_${imageIdCounter++}`, 
          src: e.target.result, 
          file: file, // Store actual file for Storage upload
          kind: 'file' 
      });
      renderImagePreviews();
    }; 
    reader.readAsDataURL(file);
  });
  event.target.value = "";
};

window.addImageURLsToSelection = () => {
  const urlInput = document.getElementById("vimages").value.trim();
  if (!urlInput) return;
  
  const newUrls = urlInput.split(",").map(u => u.trim()).filter(u => u !== "");
  
  if (selectedImages.length + newUrls.length > MAX_IMAGES) {
      showToast(`Limit reached. Maximum ${MAX_IMAGES} images allowed.`, "warning");
      return;
  }

  newUrls.forEach(u => { 
      selectedImages.push({ id: `img_${imageIdCounter++}`, src: u, kind: 'url' });
  });
  
  document.getElementById("vimages").value = "";
  renderImagePreviews();
};

window.removeSelectedImage = (id) => {
  const idx = selectedImages.findIndex(i => i.id === id);
  if (idx !== -1) { selectedImages.splice(idx, 1); renderImagePreviews(); }
};

function renderImagePreviews() {
  const container = document.getElementById("imagePreviewContainer");
  if (!container) return; container.innerHTML = "";
  selectedImages.forEach(img => {
    container.innerHTML += `<div class="preview-wrapper"><img src="${img.src}"/><button type="button" class="preview-remove" onclick="removeSelectedImage('${img.id}')"><i class="fa-solid fa-xmark"></i></button></div>`;
  });
}

// ... [Keep Dynamic Dropdowns unchanged] ...
window.handleVehicleTypeChange = () => {
    const type = document.getElementById('vtype').value;
    const brandSelect = document.getElementById('vbrand');
    const modelSelect = document.getElementById('vmodel');
    const bodyTypeSelect = document.getElementById('vbodytype');
    const driveTypeSelect = document.getElementById('vdrive');

    brandSelect.innerHTML = '<option value="">Select Brand</option>';
    modelSelect.innerHTML = '<option value="">Select Model</option>';
    modelSelect.disabled = true;

    if (type && vehicleDatabase[type]) {
        Object.keys(vehicleDatabase[type]).forEach(brand => {
            const option = document.createElement('option');
            option.value = brand; option.textContent = brand;
            brandSelect.appendChild(option);
        });
        brandSelect.disabled = false;
    } else {
        brandSelect.disabled = true;
    }

    const carOnlyGroups = ['group-airbags', 'group-boot', 'group-seating'];
    const isCar = (type === 'car');

    carOnlyGroups.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = isCar ? 'block' : 'none';
    });

    if (isCar) {
        bodyTypeSelect.innerHTML = `
            <option value="SUV">SUV</option>
            <option value="Sedan">Sedan</option>
            <option value="Hatchback">Hatchback</option>
            <option value="MUV">MUV</option>
            <option value="Coupe">Coupe</option>
            <option value="Convertible">Convertible</option>
        `;
        driveTypeSelect.innerHTML = `
            <option value="FWD">FWD (Front Wheel)</option>
            <option value="RWD">RWD (Rear Wheel)</option>
            <option value="AWD">AWD (All Wheel)</option>
            <option value="4WD">4WD (Four Wheel)</option>
        `;
    } else { 
        bodyTypeSelect.innerHTML = `
            <option value="Commuter">Commuter</option>
            <option value="Sports">Sports</option>
            <option value="Cruiser">Cruiser</option>
            <option value="Scooter">Scooter</option>
            <option value="Off-road">Off-road</option>
        `;
        driveTypeSelect.innerHTML = `
            <option value="Chain">Chain Drive</option>
            <option value="Belt">Belt Drive</option>
            <option value="Shaft">Shaft Drive</option>
        `;
    }
};

window.populateModels = () => {
    const type = document.getElementById('vtype').value;
    const brand = document.getElementById('vbrand').value;
    const modelSelect = document.getElementById('vmodel');
    
    modelSelect.innerHTML = '<option value="">Select Model</option>';

    if (type && brand && vehicleDatabase[type][brand]) {
        vehicleDatabase[type][brand].forEach(model => {
            const option = document.createElement('option');
            option.value = model; option.textContent = model;
            modelSelect.appendChild(option);
        });
        modelSelect.disabled = false;
    } else {
        modelSelect.disabled = true;
    }
};

// 📝 UPDATED ADD VEHICLE: UPLOAD TO STORAGE THEN FIRESTORE
window.addVehicle = async () => {
  if (!currentUserId) return showToast("Log in to sell.", "warning");
  
  const sellerData = {
      name: document.getElementById("sellername").value.trim(),
      email: document.getElementById("selleremail").value.trim(),
      phone: document.getElementById("sellerphone").value.trim(),
      altPhone: document.getElementById("selleraltphone").value.trim(),
      address: document.getElementById("selleraddress").value.trim()
  };
  
  const type = document.getElementById("vtype").value;
  const brand = document.getElementById("vbrand").value;
  const model = document.getElementById("vmodel").value;
  const year = document.getElementById("vyear").value.trim();
  const km = document.getElementById("vkm").value.trim();
  const price = document.getElementById("vprice").value.trim();
  const desc = document.getElementById("vdescription").value.trim();

  const specs = {
      fuel: document.getElementById("vfuel").value,
      transmission: document.getElementById("vtransmission").value,
      bodyType: document.getElementById("vbodytype").value,
      mileage: document.getElementById("vmileage").value.trim(),
      engine: document.getElementById("vengine").value.trim(),
      torque: document.getElementById("vtorque").value.trim(),
      airbags: type === 'car' ? document.getElementById("vairbags").value.trim() : null,
      bootSpace: type === 'car' ? document.getElementById("vboot").value.trim() : null,
      groundClearance: document.getElementById("vground").value.trim(),
      fuelTank: document.getElementById("vtank").value.trim(),
      seating: type === 'car' ? document.getElementById("vseating").value.trim() : null,
      driveType: document.getElementById("vdrive").value
  };

  addImageURLsToSelection();

  if (!sellerData.name || !sellerData.phone || !brand || !model || !price) return showToast("Fill required fields!", "warning");
  if (selectedImages.length === 0) return showToast("Add at least one image.", "warning");

  const fullName = `${brand} ${model}`;

  showLoader();

  try {
      // 1. Upload Images to Storage
      const uploadedImageUrls = await Promise.all(selectedImages.map(async (img) => {
          if (img.kind === 'url') {
              return img.src; // Already a URL
          } else {
              // It's a file, upload it
              const storageRef = ref(storage, `vehicle_images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${img.file.name}`);
              await uploadBytes(storageRef, img.file);
              return await getDownloadURL(storageRef);
          }
      }));

      // 2. Save Data to Firestore
      await addDoc(collection(db, "vehicles"), {
        seller: sellerData, 
        name: fullName, 
        type, brand, model, year, km, price, description: desc,
        specs: specs,
        img: uploadedImageUrls[0], // First image as main
        vimages: uploadedImageUrls.join(","), // All images as CSV string
        status: "pending", 
        submittedBy: currentUserEmail 
      });

      showToast("Submitted for approval!", "success");
      
      // Clear form
      document.querySelectorAll("#sell-view input, #sell-view textarea, #sell-view select").forEach(i => i.value = "");
      selectedImages.length = 0; 
      renderImagePreviews();
      if(auth.currentUser) loadUserProfile(auth.currentUser); 
      
      showSection('history'); 

  } catch (err) {
      console.error(err);
      showToast("Error submitting: " + err.message, "error");
  } finally {
      hideLoader();
  }
};

// ... [Keep Load Vehicles, History, UI Logic, Filter unchanged] ...
const vehicleGrid = document.getElementById("vehicleGrid");

const vehiclesQuery = query(collection(db, "vehicles"), where("status", "==", "approved"));

onSnapshot(vehiclesQuery, (snapshot) => {
  vehicleGrid.innerHTML = "";
  const cards = [];
  
  snapshot.forEach((doc) => {
    const v = doc.data();
    const vehicleKey = doc.id; 
    
    const displayPrice = v.adminPrice || v.price || 0; 
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.type = v.type; card.dataset.name = v.name;
    card.dataset.year = v.year; card.dataset.km = v.km; card.dataset.price = displayPrice; 
    
    card.innerHTML = `
      <div class="card-image" style="background-image: url('${v.img}');" onclick="openDetailsModal('${vehicleKey}')" style="cursor:pointer">
           <div class="card-price" style="position:absolute; bottom:10px; left:15px; color:white; text-shadow:0 2px 4px rgba(0,0,0,0.8);">₹${parseInt(displayPrice).toLocaleString('en-IN')}</div>
      </div>
      <div class="card-content">
        <h3 style="cursor:pointer" onclick="openDetailsModal('${vehicleKey}')">${v.name}</h3>
        <p class="card-specs"><i class="fa-solid fa-calendar"></i> ${v.year} &nbsp;|&nbsp; <i class="fa-solid fa-gauge"></i> ${v.km} km</p>
        <p class="card-desc">${(v.description || '').substring(0, 60)}...</p>
        <div class="card-footer">
          <div class="action-buttons" style="width:100%">
              <button class="btn btn-outline" style="flex:1" onclick="openDetailsModal('${vehicleKey}')"><i class="fa-solid fa-eye"></i> View</button>
              <button class="btn btn-primary" style="flex:1" onclick="buyVehicle('${vehicleKey}', '${v.name}', '${displayPrice}')">Buy</button>
          </div>
        </div>
      </div>
    `;
    cards.push(card);
  });
  cards.forEach(c => vehicleGrid.appendChild(c));
  filterVehicles(); 
});

window.loadSellHistory = async () => {
    const historyTableBody = document.getElementById("historyTableBody");
    historyTableBody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";
    if (!currentUserEmail) { historyTableBody.innerHTML = '<tr><td colspan="6">Log in to view history.</td></tr>'; return; }
    
    const q = query(collection(db, "vehicles"), where("submittedBy", "==", currentUserEmail));

    onSnapshot(q, (snapshot) => {
        historyTableBody.innerHTML = "";
        let records = 0;
        snapshot.forEach((doc) => {
            const v = doc.data(); 
            records++;
            const statusClass = v.status === 'approved' ? 'approved' : (v.status === 'rejected' ? 'rejected' : 'pending');
            
            // Updated with data-label for Grid Layout View
            const row = `<tr>
                <td data-label="Vehicle">${v.name}</td> 
                <td data-label="Type">${v.type}</td>
                <td data-label="Price">₹${parseInt(v.price || 0).toLocaleString('en-IN')}</td>
                <td data-label="Status"><span class="status-badge ${statusClass}">${v.status}</span></td>
                <td data-label="Action"><button class="btn btn-outline" style="padding:4px 8px; font-size:12px;" onclick="showToast('Status: ${v.status}', 'success')">View</button></td>
            </tr>`;
            historyTableBody.insertAdjacentHTML("beforeend", row);
        });
        if (records === 0) historyTableBody.innerHTML = "<tr><td colspan='6'>No submissions yet.</td></tr>";
    });
};

window.toggleDrawer = () => {
    const drawer = document.getElementById('drawer-menu');
    const overlay = document.getElementById('drawer-overlay');
    const isOpen = drawer.classList.contains('open');
    if (isOpen) { drawer.classList.remove('open'); setTimeout(() => overlay.style.display='none', 300); }
    else { overlay.style.display='block'; setTimeout(() => drawer.classList.add('open'), 10); }
}

window.showSection = (sectionId) => {
    const drawer = document.getElementById('drawer-menu');
    if (drawer.classList.contains('open')) window.toggleDrawer();

    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(sectionId + '-view');
    if (target) { target.classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); }

    document.querySelectorAll('.drawer-nav .nav-item').forEach(i => {
        i.classList.remove('active');
        if (i.dataset.section === sectionId) i.classList.add('active');
    });
    
    if (sectionId === 'cart') loadCartItems();
    else if (sectionId === 'order') loadOrdersHistory();
    else if (sectionId === 'history') loadSellHistory();
}

window.filterVehicles = () => {
  const grid = document.getElementById("vehicleGrid");
  const search = document.getElementById('search').value.toLowerCase();
  const type = document.getElementById('filter').value;
  const sortBy = document.getElementById('sort').value;
  const cards = Array.from(grid.children);

  cards.forEach(card => {
    const matchesSearch = !search || card.dataset.name.toLowerCase().includes(search);
    const matchesType = (type === 'all' || card.dataset.type === type);
    card.style.display = (matchesSearch && matchesType) ? "flex" : "none";
  });

  const visible = cards.filter(c => c.style.display !== 'none');
  visible.sort((a, b) => {
    const [key, dir] = sortBy.split('_');
    if (key === 'default') return 0;
    if (['year', 'km', 'price'].includes(key)) return dir === 'asc' ? (a.dataset[key] - b.dataset[key]) : (b.dataset[key] - a.dataset[key]);
    return dir === 'asc' ? a.dataset.name.localeCompare(b.dataset.name) : b.dataset.name.localeCompare(a.dataset.name);
  });
  visible.forEach(c => grid.appendChild(c));
};

document.addEventListener('DOMContentLoaded', () => {
    showSection('home'); hideLoader();
    ['modalDownPayment','modalLoanTenure','modalInterestRate','modalPaymentOption'].forEach(id => {
        const el = document.getElementById(id); if(el) el.addEventListener(id === 'modalDownPayment' ? 'input' : 'change', window.updateEMICalculation);
    });
    ['cartDownPayment','cartLoanTenure','cartInterestRate','cartPaymentOption'].forEach(id => {
        const el = document.getElementById(id); if(el) el.addEventListener(id === 'cartDownPayment' ? 'input' : 'change', window.updateCartEMICalculation);
    });

    ['search','filter','sort'].forEach(id => document.getElementById(id)?.addEventListener(id === 'search'?'input':'change', window.filterVehicles));
});