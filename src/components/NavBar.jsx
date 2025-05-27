import React, { useState } from 'react';
import { Link } from 'react-router-dom';

//Navigation setup
function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const toggleUpload = () => setUploadOpen((prev) => !prev);

  const closeMenu = () => {
    setMenuOpen(false);
    setUploadOpen(false);
  };

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 20px',
      borderBottom: '1px solid #ccc',
      marginBottom: '20px',
      backgroundColor: '#f0f0f0',
      position: 'relative',
      
    }}>
      {/* Left-side dropdown */}
      <div className="dropdown">
        <button className="dropbtn" onClick={toggleMenu}>☰ Menu</button>

        {menuOpen && (
          <div className="dropdown-content">
            <Link to="/" onClick={closeMenu}>Home</Link>

            <div className="submenu-container">
              <div className="submenu-title" onClick={toggleUpload}>
                Tools <span className="arrow">{uploadOpen ? '▼' : '▸'}</span>
              </div>
              {uploadOpen && (
                <div className="submenu-content">
                  <Link to="/recons/" onClick={closeMenu}>Reconciliation Tools</Link>
                  <Link to="/upload/op2" onClick={closeMenu}>Promotion Tools</Link>
                </div>
              )}
            </div>

            <Link to="/detailed-view" onClick={closeMenu}>Detailed View</Link>
            <Link to="/contact" onClick={closeMenu}>Contact</Link>
          </div>
        )}
      </div>

      {/* Right static navigation (optional) */}
      <div>
        <Link to="/" style={{ marginRight: '10px' }}>Home</Link>
        <Link to="/upload" style={{ marginRight: '10px' }}>Upload</Link>
        <Link to="/test" style={{ marginRight: '10px' }}>Test</Link>
        <Link to="/contact">Contact</Link>
      </div>

      {/* Styles */}
      <style>{`
        .dropbtn {
          background-color:rgb(240, 240, 240);
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 8px 50px;
        }

        .dropdown-content {
          position: absolute;
          top: 50px;
          left: 20px;
          background-color: white;
          box-shadow: 0px 8px 16px rgba(0,0,0,0.2);
          padding: 10px;
          min-width: 200px;
          z-index: 999;
        }

        .dropdown-content a {
          display: block;
          padding: 8px;
          text-decoration: none;
          color: black;
        }

        .dropdown-content a:hover {
          background-color: #f2f2f2;
        }

        .submenu-title {
          cursor: pointer;
          padding: 8px;
          user-select: none;
        }

        .submenu-content {
          padding-left: 15px;
          padding-bottom: 5px;
        }

        .submenu-content a {
          display: block;
          padding: 6px 8px;
          text-decoration: none;
          color: black;
        }

        .submenu-content a:hover {
          background-color: #f2f2f2;
        }

        .arrow {
          margin-left: 5px;
        }
      `}</style>
    </nav>
  );
}

export default Navbar;