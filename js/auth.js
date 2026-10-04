document.addEventListener('DOMContentLoaded', function() {
    // 登录表单处理
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
        
            console.log('登录信息:', { username, password });
          
            alert('登录成功！');
            window.location.href = 'index.html';
        });
    }


    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
           
            if (password !== confirmPassword) {
                alert('两次输入的密码不一致！');
                return;
            }

            if (password.length < 6) {
                alert('密码长度必须至少为6个字符！');
                return;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('请输入有效的电子邮箱地址！');
                return;
            }

            console.log('注册信息:', { username, email, password });
            
            alert('注册成功！请登录您的账户。');
            window.location.href = 'login.html';
        });
    }

    const inputs = document.querySelectorAll('.auth-form input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });

        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentElement.classList.remove('focused');
            }
        });
    });
});


function checkPasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength++;
    
    
    if (/[a-zA-Z]/.test(password)) strength++;
    
    if (/[0-9]/.test(password)) strength++;
    
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    return strength;
}


document.getElementById('password')?.addEventListener('input', function() {
    const strength = checkPasswordStrength(this.value);
    let strengthText = '';
    let strengthColor = '';
    
    switch(strength) {
        case 0:
        case 1:
            strengthText = '弱';
            strengthColor = '#ff4d4d';
            break;
        case 2:
            strengthText = '中';
            strengthColor = '#ffa64d';
            break;
        case 3:
            strengthText = '强';
            strengthColor = '#2ecc71';
            break;
        case 4:
            strengthText = '很强';
            strengthColor = '#27ae60';
            break;
    }
    
    console.log('密码强度:', strengthText);
});
