import React from "react";
import BottomBanner from "../components/BottomBanner.js";

function AboutUs() {
  return (
    <>
      <div className="about-page">
        <div className="about-container">
          {/* -- TOP SECTION with heading + bar + main text -- */}
          <div className="about-top-section">
            {/* COLUMN 1: HEADING */}
            <div className="about-heading-column">
              {/* Viserra is now part of the main title, no longer highlighted */}
              <h1 className="about-main-title">
                About Viserra
              </h1>
            </div>

            {/* COLUMN 2: VERTICAL BAR */}
            <div className="about-separator"></div>

            {/* COLUMN 3: MAIN TEXT */}
            <div className="about-text-column">
              <h2 className="about-sub-title">
                A New Vision for Real Estate Investing
              </h2>
              <p className="about-paragraph">
                {/* Added 'about-highlight-word' class to these strong tags */}
                Viserra combines <strong className="about-highlight-word">“Vision”</strong> and <strong className="about-highlight-word">“Terra”</strong>
                (Latin for “land”) to embody our mission: bringing a fresh perspective
                to real estate investment. We draw on decades of experience
                in REIT equity research and private equity real estate, and cutting‐edge
                software development. By blending real‐estate domain knowledge with
                modern data science, we aim to create a platform that empowers
                investors in both public and private markets.
              </p>
              <p className="about-paragraph">
                Unlike generic stock analytics platforms, Viserra is purpose‐built for real
                estate. We cover everything from FFO and NOI to Cap Rates and NAV,
                offering specialized metrics that real‐estate investors rely on. We
                also pride ourselves on meticulous data accuracy, as we devote extra effort
                to verify and maintain the integrity of every dataset on our platform.
              </p>
            </div>
          </div>

          {/* -- WHY VISERRA SECTION -- */}
          <div className="about-why-section">
            <h2 className="about-sub-title">
              Why Viserra?
            </h2>
            <div className="about-points-container">
              <div className="about-point">
                <strong className="about-point-strong">Built for Real Estate</strong> &nbsp;
                We specialize in REITs and property‐focused crowdfunding investments.
                No more wasting time on generic stock metrics that don’t apply.
              </div>
              <div className="about-point">
                <strong className="about-point-strong">Data Accuracy</strong> &nbsp;
                We painstakingly checks official company filings, prospectuses,
                and investor relations documents to ensure each data point is
                thoroughly verified.
              </div>
              <div className="about-point">
                <strong className="about-point-strong">Unmatched Data Depth</strong> &nbsp;
                Our platform is backed by some of the world’s most comprehensive financial databases,
                including S&P Capital IQ, Bloomberg, MSCI Real Capital Analytics, and CoStar.
                This enable us to provide a depth of data that is unmatched in the industry.
              </div>
              <div className="about-point">
                <strong className="about-point-strong">Quantitative Scoring System</strong> &nbsp;
                Our proprietary scoring system assesses real estate investments
                using real time pricing and operating data. We do the heavy lifting
                analysis so you don’t have to.
              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomBanner />
    </>
  );
}

export default AboutUs;