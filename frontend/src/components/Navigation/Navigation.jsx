import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigate = useNavigate();

  const {
    isAuthenticated,
    profile,
    logout,
    loading,
  } = useAuth();

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleSignOut = async () => {
    try {
      if (typeof logout === 'function') {
        await logout();
      }

      closeMenu();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  /*
   * Use the application profile from AuthContext.
   *
   * Possible profile structures:
   * profile.name
   * profile.fullName
   * profile.firstName
   * profile.displayName
   */
  const userName =
    profile?.name ||
    profile?.fullName ||
    profile?.firstName ||
    profile?.displayName ||
    '';

  const showUserActions =
    !loading &&
    isAuthenticated &&
    Boolean(profile);

  const navLinkClass = ({ isActive }) =>
    [
      'relative py-2 text-sm transition-colors duration-200',
      isActive
        ? 'font-semibold text-[#201b1f]'
        : 'text-[#776e75] hover:text-[#201b1f]',
    ].join(' ');

  return (
    <header className="relative z-50 w-full border-b border-[#eadfe1] bg-[#fffdfb]">

      {/* =========================================================
          MAIN NAVBAR
      ========================================================= */}
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between px-5 md:h-20 md:px-8">

        {/* =======================================================
            LOGO
        ======================================================= */}
        <Link
          to="/"
          onClick={closeMenu}
          className="font-['Instrument_Serif'] text-[22px] tracking-tight text-[#292329] md:text-[24px]"
        >
          SkinDecode<span className="text-[#e47796]">.</span>
        </Link>

        {/* =======================================================
            DESKTOP CENTER NAVIGATION
        ======================================================= */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">

          <NavLink
            to="/products"
            className={navLinkClass}
          >
            Products
          </NavLink>

          <NavLink
            to="/skin-routine"
            className={navLinkClass}
          >
            Skin Routine
          </NavLink>

        </nav>

        {/* =======================================================
            DESKTOP RIGHT SIDE
        ======================================================= */}
        <div className="ml-auto hidden items-center gap-5 md:flex">

          {/* User Name → Dashboard */}
          {showUserActions && userName && (
            <Link
              to="/dashboard"
              className="
                font-['Instrument_Serif']
                text-[18px]
                tracking-wide
                text-[#4b4147]
                transition-colors
                duration-200
                hover:text-[#e47796]
              "
              aria-label={`Go to dashboard for ${userName}`}
            >
              {userName}
            </Link>
          )}

          {/* Sign Out */}
          {showUserActions && (
            <button
              type="button"
              onClick={handleSignOut}
              className="
                h-[38px]
                rounded-full
                border
                border-[#201b1f]
                bg-transparent
                px-5
                text-sm
                text-[#201b1f]
                transition-all
                duration-200
                hover:bg-[#201b1f]
                hover:text-white
                focus:outline-none
                focus:ring-2
                focus:ring-[#e47796]
                focus:ring-offset-2
              "
            >
              Sign out
            </button>
          )}

          {/* Login (shown when not authenticated) */}
          {!loading && !showUserActions && (
            <Link
              to="/login"
              className="
                h-[38px]
                inline-flex
                items-center
                rounded-full
                border
                border-[#201b1f]
                bg-transparent
                px-5
                text-sm
                text-[#201b1f]
                transition-all
                duration-200
                hover:bg-[#201b1f]
                hover:text-white
                focus:outline-none
                focus:ring-2
                focus:ring-[#e47796]
                focus:ring-offset-2
              "
            >
              Login
            </Link>
          )}

        </div>

        {/* =======================================================
            MOBILE HAMBURGER
        ======================================================= */}
        <button
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
          aria-label={
            isMenuOpen
              ? 'Close navigation menu'
              : 'Open navigation menu'
          }
          aria-expanded={isMenuOpen}
          className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] md:hidden"
        >
          <span
            className={`block h-[1.5px] w-[22px] bg-[#201b1f] transition-transform duration-200 ${
              isMenuOpen
                ? 'translate-y-[6.5px] rotate-45'
                : ''
            }`}
          />

          <span
            className={`block h-[1.5px] w-[22px] bg-[#201b1f] transition-opacity duration-200 ${
              isMenuOpen
                ? 'opacity-0'
                : 'opacity-100'
            }`}
          />

          <span
            className={`block h-[1.5px] w-[22px] bg-[#201b1f] transition-transform duration-200 ${
              isMenuOpen
                ? '-translate-y-[6.5px] -rotate-45'
                : ''
            }`}
          />
        </button>
      </div>

      {/* =========================================================
          MOBILE MENU
      ========================================================= */}
      {isMenuOpen && (
        <div className="border-t border-[#eadfe1] bg-[#fffdfb] px-5 pb-6 md:hidden">

          <nav className="flex flex-col">

            <NavLink
              to="/products"
              onClick={closeMenu}
              className={({ isActive }) =>
                [
                  'border-b border-[#eee5e6] py-4 text-[15px]',
                  isActive
                    ? 'font-semibold text-[#201b1f]'
                    : 'text-[#776e75]',
                ].join(' ')
              }
            >
              Products
            </NavLink>

            <NavLink
              to="/skin-routine"
              onClick={closeMenu}
              className={({ isActive }) =>
                [
                  'border-b border-[#eee5e6] py-4 text-[15px]',
                  isActive
                    ? 'font-semibold text-[#201b1f]'
                    : 'text-[#776e75]',
                ].join(' ')
              }
            >
              Skin Routine
            </NavLink>

          </nav>

          {/* =====================================================
              MOBILE ACCOUNT
          ===================================================== */}
          {showUserActions && (
            <div className="flex flex-col gap-4 pt-5">

              {/* User Name → Dashboard */}
              {userName && (
                <Link
                  to="/dashboard"
                  onClick={closeMenu}
                  className="
                    font-['Instrument_Serif']
                    text-[19px]
                    tracking-wide
                    text-[#292329]
                    transition-colors
                    duration-200
                    hover:text-[#e47796]
                  "
                >
                  {userName}
                </Link>
              )}

              {/* Sign Out */}
              <button
                type="button"
                onClick={handleSignOut}
                className="
                  h-11
                  w-full
                  rounded-full
                  border
                  border-[#201b1f]
                  bg-transparent
                  text-sm
                  text-[#201b1f]
                  transition-colors
                  hover:bg-[#201b1f]
                  hover:text-white
                  focus:outline-none
                  focus:ring-2
                  focus:ring-[#e47796]
                  focus:ring-offset-2
                "
              >
                Sign out
              </button>

            </div>
          )}

          {/* Login (shown when not authenticated) */}
          {!loading && !showUserActions && (
            <div className="pt-5">
              <Link
                to="/login"
                onClick={closeMenu}
                className="
                  flex
                  h-11
                  w-full
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-[#201b1f]
                  bg-transparent
                  text-sm
                  text-[#201b1f]
                  transition-colors
                  hover:bg-[#201b1f]
                  hover:text-white
                  focus:outline-none
                  focus:ring-2
                  focus:ring-[#e47796]
                  focus:ring-offset-2
                "
              >
                Login
              </Link>
            </div>
          )}

        </div>
      )}
    </header>
  );
}