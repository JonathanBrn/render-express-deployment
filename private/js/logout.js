function logoutUser() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userPhone');
    sessionStorage.clear();
    
    location.reload();
}