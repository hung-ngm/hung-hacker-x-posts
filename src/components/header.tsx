import Link from "next/link";

export function Header() {
  return (
    <tr>
      <td className="bg-[#ff6600] px-[2px] py-[2px]">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="w-[18px] pr-1 align-middle">
                <Link href="/" aria-label="Home" className="block border border-white">
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <rect width="18" height="18" fill="#ff6600" />
                    <text
                      x="9"
                      y="13.5"
                      textAnchor="middle"
                      fontFamily="Verdana, Geneva, sans-serif"
                      fontSize="12"
                      fontWeight="700"
                      fill="#ffffff"
                    >
                      H
                    </text>
                  </svg>
                </Link>
              </td>
              <td className="align-middle">
                <span className="pagetop">
                  <b className="mr-[5px]">
                    <Link href="/">Hung Hacker X Posts</Link>
                  </b>
                  {" | "}
                  <Link href="/new">new</Link>
                  {" | "}
                  <Link href="/from">from</Link>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}
